"use client";

import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readLocal, writeLocal, STORAGE_KEYS } from "./localStore";
import { detectPlatform, isStandalone } from "./pwa";

/**
 * Notifikace na straně aplikace: odběr zařízení a nastavení účtu.
 *
 * Posílá je server (supabase/functions/push, plán v docs/notifikace.md).
 * Tady se jen zjistí, jestli to zařízení umí, požádá se o povolení,
 * odběr se zapíše na účet a srovná se, co server potřebuje do textů.
 */

/**
 * Veřejný klíč VAPID. Je veřejný z povahy věci — soukromý leží ve Vaultu.
 * Stojí v kódu, ne v proměnné prostředí, aby na něm nezávisel build.
 */
export const VAPID_PUBLIC_KEY =
  "BGviqaf2JZCfwk_aOCBwDS86pGvuo00__tSAAF50wY-Jaw7M8zIm-3KpMbz3ZnUx-KgdMrd0eFHSjYhnRGNa6lE";

/**
 * - `unsupported` — prohlížeč push neumí (nebo běží vývojový server bez
 *   service workeru)
 * - `needsInstall` — iPhone v prohlížeči: push dostane jen aplikace z plochy
 * - `available` — dá se zapnout
 */
export type PushAvailability = "unsupported" | "needsInstall" | "available";

export type PushStatus = {
  ready: boolean;
  availability: PushAvailability;
  permission: NotificationPermission;
  /** Zařízení má odběr v prohlížeči a povolení. */
  subscribed: boolean;
  /**
   * Účet, který notifikace na zařízení zapnul. Zapnuté jsou jen tomu —
   * po odhlášení a přihlášení někoho jiného se neukazují jako zapnuté.
   */
  owner: string;
};

const INITIAL: PushStatus = {
  ready: false,
  availability: "unsupported",
  permission: "default",
  subscribed: false,
  owner: "",
};

/** Má přihlášený uživatel na tomto zařízení notifikace zapnuté? */
export function pushOnFor(status: PushStatus, userId: string | undefined): boolean {
  return Boolean(userId) && status.subscribed && status.owner === userId;
}

let status: PushStatus = INITIAL;
const listeners = new Set<() => void>();
let started = false;

function publish(next: PushStatus) {
  status = next;
  for (const listener of listeners) listener();
}

function availability(): PushAvailability {
  if (typeof window === "undefined") return "unsupported";
  const platform = detectPlatform();
  const ios = platform === "ios-safari" || platform === "ios-other-browser";
  // iOS nabízí Notification i PushManager jen aplikaci z plochy, takže
  // v prohlížeči by kontrola níže řekla „neumí“ — a to není pravda.
  if (ios && !isStandalone()) return "needsInstall";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return "available";
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // `ready` ve vývoji nikdy nedoběhne — service worker se registruje jen
  // z produkčního buildu (ServiceWorkerRegistrar).
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

/** Přečte stav znovu. Volá se po změně a po návratu do aplikace. */
export async function refreshPushStatus(): Promise<void> {
  const current = availability();
  if (current !== "available") {
    publish({ ...INITIAL, ready: true, availability: current });
    return;
  }
  const worker = await registration();
  if (!worker) {
    publish({ ...INITIAL, ready: true, permission: Notification.permission });
    return;
  }
  const subscription = await worker.pushManager.getSubscription().catch(() => null);
  publish({
    ready: true,
    availability: "available",
    permission: Notification.permission,
    subscribed: subscription !== null && Notification.permission === "granted",
    owner: readLocal(STORAGE_KEYS.pushOwner) ?? "",
  });
}

export function usePushStatus(): PushStatus {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      if (!started) {
        started = true;
        void refreshPushStatus();
        // Povolení se dá změnit v nastavení systému, mimo aplikaci.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void refreshPushStatus();
        });
      }
      return () => listeners.delete(onChange);
    },
    () => status,
    () => INITIAL,
  );
}

function applicationServerKey(): Uint8Array<ArrayBuffer> {
  const base64 = VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(subscription: PushSubscription): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const expected = applicationServerKey();
  const actual = new Uint8Array(current);
  return actual.length === expected.length && actual.every((byte, i) => byte === expected[i]);
}

/** Odběr zařízení; když chybí nebo patří starému klíči, založí nový. */
async function deviceSubscription(worker: ServiceWorkerRegistration): Promise<PushSubscription> {
  const existing = await worker.pushManager.getSubscription();
  if (existing && sameKey(existing)) return existing;
  await existing?.unsubscribe();
  return worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey() });
}

async function register(client: SupabaseClient, subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  const { error } = await client.rpc("register_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
  });
  if (error) throw new Error(error.message);
}

export type EnableResult = "enabled" | "denied" | "failed";

/**
 * Zapne notifikace na tomto zařízení.
 *
 * Musí se volat přímo z klepnutí: iOS dotaz na povolení jinak vůbec
 * neukáže. Proto je `requestPermission` první věc, na kterou se čeká.
 */
export async function enablePush(
  client: SupabaseClient,
  userId: string,
  settings: Partial<NotificationPrefs> & DeviceFacts,
): Promise<EnableResult> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    await refreshPushStatus();
    return permission === "denied" ? "denied" : "failed";
  }

  try {
    const worker = await registration();
    if (!worker) return "failed";
    const subscription = await deviceSubscription(worker);
    await register(client, subscription);
    writeLocal(STORAGE_KEYS.pushRegistered, `${userId}|${subscription.endpoint}`);
    await savePrefs(client, userId, settings);
    writeLocal(STORAGE_KEYS.pushOwner, userId);
    await refreshPushStatus();
    return "enabled";
  } catch {
    await refreshPushStatus();
    return "failed";
  }
}

/**
 * Vypne notifikace na tomto zařízení. Ostatní zařízení účtu to nechá být
 * — kdo je vypne na tabletu, chce je dál na telefonu.
 */
export async function disablePush(client: SupabaseClient): Promise<void> {
  const worker = await registration();
  const subscription = await worker?.pushManager.getSubscription();
  if (subscription) {
    await client.rpc("unregister_push_subscription", { p_endpoint: subscription.endpoint });
    await subscription.unsubscribe().catch(() => {});
  }
  writeLocal(STORAGE_KEYS.pushOwner, "");
  writeLocal(STORAGE_KEYS.pushRegistered, "");
  await refreshPushStatus();
}

/**
 * Před odhlášením: zařízení přestane patřit účtu, ale odběr v prohlížeči
 * zůstane. Když se týž člověk přihlásí znovu, `restorePushDevice` ho
 * zapíše zpátky a nemusí nic zapínat. Někomu jinému se nic neobnoví —
 * obnova hlídá, kdo notifikace zapnul.
 */
export async function detachPushDevice(client: SupabaseClient): Promise<void> {
  try {
    const worker = await registration();
    const subscription = await worker?.pushManager.getSubscription();
    if (subscription) await client.rpc("unregister_push_subscription", { p_endpoint: subscription.endpoint });
    // Po přihlášení se odběr musí zapsat znovu.
    writeLocal(STORAGE_KEYS.pushRegistered, "");
  } catch {
    // Bez sítě se odběr na serveru nesmaže. Při dalším odeslání ho server
    // zkusí a push služba ho odmítne teprve po odinstalaci — cenou je
    // nejvýš pár zpráv navíc, ne zablokované odhlášení.
  }
}

/**
 * Po spuštění: když uživatel notifikace na tomhle zařízení zapnul, odběr
 * se srovná se serverem. Push služba ho občas vymění (service worker
 * pak založí nový, ale zapsat ho na účet neumí) a po odhlášení a novém
 * přihlášení je potřeba ho zapsat zpátky.
 */
export async function restorePushDevice(client: SupabaseClient, userId: string): Promise<void> {
  if (readLocal(STORAGE_KEYS.pushOwner) !== userId) return;
  if (availability() !== "available" || Notification.permission !== "granted") return;
  const worker = await registration();
  if (!worker) return;
  const subscription = await deviceSubscription(worker);
  // Server ten odběr už zná: dřív šel zápis při každém spuštění (v logu
  // 28× za den) se stejnými údaji.
  if (readLocal(STORAGE_KEYS.pushRegistered) !== `${userId}|${subscription.endpoint}`) {
    await register(client, subscription);
    writeLocal(STORAGE_KEYS.pushRegistered, `${userId}|${subscription.endpoint}`);
  }
  await refreshPushStatus();
}

// ---------------------------------------------------------------------------
// Nastavení účtu
// ---------------------------------------------------------------------------

export type NotificationPrefs = {
  /** HH:MM, místní čas. */
  reminderTime: string;
  streak: boolean;
  lastChance: boolean;
  social: boolean;
  league: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  reminderTime: "19:00",
  streak: true,
  lastChance: true,
  social: true,
  league: true,
};

/** Rozsah, který připustí databáze (migrace 0008). */
export const REMINDER_EARLIEST = "06:00";
export const REMINDER_LATEST = "21:00";

/**
 * Co server potřebuje do textů a do výpočtu místního času. Série se
 * posílá tak, jak ji vidí telefon — ochrany série žijí jen v něm.
 */
export type DeviceFacts = {
  locale?: string;
  streakDays?: number;
  streakFreezes?: number;
  lastLessonDay?: string | null;
};

export function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Prague";
  } catch {
    return "Europe/Prague";
  }
}

export async function fetchPrefs(client: SupabaseClient, userId: string): Promise<NotificationPrefs> {
  const { data, error } = await client
    .from("notification_prefs")
    .select("reminder_time, streak, last_chance, social, league")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_PREFS;
  return {
    reminderTime: String(data.reminder_time).slice(0, 5),
    streak: data.streak,
    lastChance: data.last_chance,
    social: data.social,
    league: data.league,
  };
}

export async function savePrefs(
  client: SupabaseClient,
  userId: string,
  patch: Partial<NotificationPrefs> & DeviceFacts,
): Promise<void> {
  const row: Record<string, unknown> = { user_id: userId, time_zone: timeZone(), updated_at: new Date().toISOString() };
  if (patch.reminderTime !== undefined) row.reminder_time = clampTime(patch.reminderTime);
  if (patch.streak !== undefined) row.streak = patch.streak;
  if (patch.lastChance !== undefined) row.last_chance = patch.lastChance;
  if (patch.social !== undefined) row.social = patch.social;
  if (patch.league !== undefined) row.league = patch.league;
  if (patch.locale !== undefined) row.locale = patch.locale === "sk" ? "sk" : "cs";
  if (patch.streakDays !== undefined) row.streak_days = patch.streakDays;
  if (patch.streakFreezes !== undefined) row.streak_freezes = Math.min(patch.streakFreezes, 10);
  if (patch.lastLessonDay !== undefined) row.last_lesson_day = patch.lastLessonDay;

  const { error } = await client.from("notification_prefs").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

/** Čas mimo rozsah databáze by zápis shodil; raději se srovná na okraj. */
export function clampTime(value: string): string {
  if (!/^\d{2}:\d{2}$/.test(value)) return DEFAULT_PREFS.reminderTime;
  if (value < REMINDER_EARLIEST) return REMINDER_EARLIEST;
  if (value > REMINDER_LATEST) return REMINDER_LATEST;
  return value;
}

/**
 * Ukázková notifikace hned po zapnutí. Uživatel vidí, že to funguje
 * a jak to bude vypadat — a na iOS se tím aplikace rovnou objeví
 * v Nastavení › Oznámení.
 */
export async function showWelcomeNotice(title: string, body: string): Promise<void> {
  const worker = await registration();
  await worker
    ?.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: "welcome",
      data: { url: "/" },
    })
    .catch(() => {});
}
