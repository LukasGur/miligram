"use client";

/**
 * Kam má aplikace skočit po klepnutí na notifikaci.
 *
 * Cíl přijde dvěma cestami: zavřená aplikace se otevře s adresou
 * (`/?lesson=daily`, `/?open=duels`, `/?pritel=jana_k`), běžící dostane zprávu od service
 * workeru — přenačtení by zahodilo rozehranou lekci. Obojí končí tady.
 * Adresou se vrací i přenačtení po zaseknutém načtení obrazovky
 * (`/?open=stats`, `/?open=program`, src/lib/screenLoad.ts).
 *
 * Cíl čeká, dokud si ho někdo nevyzvedne: domovská obrazovka ho umí
 * splnit až po načtení programu, a do té doby odpovídá „ještě ne“.
 */
export type OpenIntent =
  | "lesson"
  | "account"
  | "duels"
  | "league"
  | "stats"
  | "program"
  | `invite:${string}`
  | `duel:${string}`;

/** Odložený cíl ze service workeru (scripts/sw.template.js). */
const INTENT_CACHE = "miligram-intent";
const INTENT_KEY = "/__miligram-intent";
/** Starší cíl už nepatří k čerstvému klepnutí — aplikace se otevřela jinak. */
const INTENT_MAX_AGE_MS = 5 * 60_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Co stálo v klepnuté notifikaci. Chybí, když cíl přišel adresou. */
export type IntentNote = { title: string; body: string };

/**
 * Vrací true, když cíl splnil; jinak cíl počká na další pokus. `note`
 * dostane obsluha, která cíl zrovna splnit nemůže (běží lekce) a chce
 * aspoň ukázat, co čeká.
 */
type Handler = (intent: OpenIntent, note: IntentNote | null) => boolean;

let pending: OpenIntent | null = null;
let pendingNote: IntentNote | null = null;

function readNote(value: unknown): IntentNote | null {
  const note = value as { title?: unknown; body?: unknown } | null | undefined;
  if (!note || typeof note.title !== "string" || note.title === "") return null;
  return { title: note.title, body: typeof note.body === "string" ? note.body : "" };
}
const handlers = new Set<Handler>();
let started = false;

export function parseOpenIntent(href: string): OpenIntent | null {
  const url = new URL(href, "https://miligram.invalid");
  if (url.searchParams.get("lesson") === "daily") return "lesson";
  // Konkrétní souboj (supabase/functions/push/compose.ts). Starší verze
  // aplikace parametr přejdou a otevřou podle `open=duels` aspoň seznam.
  const duel = url.searchParams.get("duel");
  if (duel && UUID.test(duel)) return `duel:${duel.toLowerCase()}`;
  const open = url.searchParams.get("open");
  if (open === "account" || open === "duels" || open === "league" || open === "stats" || open === "program") return open;
  // Pozvánka od kamaráda (src/lib/social.ts, INVITE_PARAM).
  const invite = url.searchParams.get("pritel")?.toLowerCase();
  if (invite && /^[a-z0-9_]{3,20}$/.test(invite)) return `invite:${invite}`;
  return null;
}

function offer() {
  if (!pending) return;
  for (const handler of handlers) {
    if (handler(pending, pendingNote)) {
      pending = null;
      pendingNote = null;
      return;
    }
  }
}

function start() {
  pending = parseOpenIntent(window.location.href);
  if (window.location.search) {
    // Adresa se uklidí, ať přenačtení nebo sdílení cíl nezopakuje.
    window.history.replaceState(null, "", window.location.pathname);
  }

  navigator.serviceWorker?.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; url?: string; note?: unknown } | null;
    if (data?.type !== "miligram:navigate" || !data.url) return;
    pending = parseOpenIntent(data.url);
    pendingNote = pending ? readNote(data.note) : null;
    // Tentýž cíl leží i v cache; vyzvednutý podruhé by obrazovku otevřel znovu.
    void takeStashed();
    offer();
  });

  void claimStashed();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void claimStashed();
  });
}

/** Vyzvedne a smaže cíl, který odložil service worker. */
async function takeStashed(): Promise<{ url: string; at: number; note: IntentNote | null } | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(INTENT_CACHE);
    const stored = await cache.match(INTENT_KEY);
    if (!stored) return null;
    await cache.delete(INTENT_KEY);
    const data = (await stored.json()) as { url?: unknown; at?: unknown; note?: unknown };
    return typeof data.url === "string" && typeof data.at === "number"
      ? { url: data.url, at: data.at, note: readNote(data.note) }
      : null;
  } catch {
    return null;
  }
}

async function claimStashed() {
  const stashed = await takeStashed();
  if (!stashed || Date.now() - stashed.at > INTENT_MAX_AGE_MS) return;
  const intent = parseOpenIntent(stashed.url);
  if (!intent) return;
  pending = intent;
  pendingNote = stashed.note;
  offer();
}

/**
 * Přihlásí se k cílům. Čekající cíl se nabídne hned po přihlášení
 * (v další mikroúloze, ne uprostřed efektu), další, jak přijdou.
 */
export function onOpenIntent(handler: Handler): () => void {
  if (!started) {
    started = true;
    start();
  }
  handlers.add(handler);
  queueMicrotask(offer);
  return () => {
    handlers.delete(handler);
  };
}
