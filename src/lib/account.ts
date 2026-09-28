import { currentStreak } from "@/core/economy";
import { clearPulse } from "./pulse";
import { forgetRemoteQueries } from "./remoteQuery";
import { clearTones } from "./tones";
import { db, emptyProfile, eventUid, PROFILE_ID, readProfile } from "./db";

/**
 * Komu patří data v telefonu.
 *
 * Dřív nikomu: odhlášení nic nesmazalo a kdo se přihlásil po někom jiném,
 * viděl jeho skóre, sérii i chyby a stažená historie se s nimi smíchala.
 * Teď mají data vlastníka (`Profile.ownerId`) a synchronizace běží jen
 * pro něj. Pravidla:
 *
 * - registrace (účet bez historie) si data z telefonu vezme,
 * - návrat k účtu, který svoje data má, telefon vyčistí — ale až poté,
 *   co to student potvrdí,
 * - odhlášení telefon vyčistí; na účtu data zůstávají.
 */

/** Co z telefonu zmizí. Ukazuje se v upozornění před smazáním. */
export type DeviceSummary = {
  lessons: number;
  streak: number;
  pills: number;
  /** Rozehraná lekce. */
  unfinished: boolean;
};

export type BindDecision =
  /** Data patří tomuhle účtu, nebo v telefonu nic není. */
  | { action: "adopt" }
  /**
   * Telefon drží data, která k účtu nepatří: hrálo se bez účtu a účet už
   * svoje má (`anonymous`), nebo tu zůstala data jiného účtu (`otherAccount`).
   */
  | { action: "confirm"; reason: "anonymous" | "otherAccount"; summary: DeviceSummary };

export async function deviceSummary(): Promise<DeviceSummary> {
  const database = db();
  const profile = await readProfile();
  const [lessons, progress] = await Promise.all([database.lessons.count(), database.progress.count()]);
  return {
    lessons,
    streak: currentStreak({
      days: profile.streakDays,
      lastDay: profile.lastLessonDay,
      freezes: profile.streakFreezes ?? 0,
      covered: profile.coveredDays,
    }),
    pills: profile.pills,
    unfinished: progress > 0,
  };
}

function hasData(summary: DeviceSummary): boolean {
  return summary.lessons > 0 || summary.unfinished || summary.pills > 0;
}

/**
 * Rozhodne, co s daty v telefonu po přihlášení.
 *
 * `hasHistory` se ptá serveru a volá se jen tehdy, když je potřeba: když
 * telefon drží data bez vlastníka. Bez sítě vyhodí a rozhodnutí počká.
 */
export async function bindDecision(userId: string, hasHistory: () => Promise<boolean>): Promise<BindDecision> {
  const profile = await readProfile();
  if (profile.ownerId === userId) return { action: "adopt" };

  const summary = await deviceSummary();
  if (!hasData(summary)) return { action: "adopt" };

  // Data jiného účtu: vlastník je zapsaný, nebo — z doby před vlastníky —
  // se na zařízení stahovala historie někoho jiného.
  const owner = profile.ownerId ?? profile.restoredFor;
  if (owner === userId) return { action: "adopt" };
  if (owner !== undefined) return { action: "confirm", reason: "otherAccount", summary };

  // Hrálo se bez účtu. Registrace si data vezme, existující účet ne.
  return (await hasHistory()) ? { action: "confirm", reason: "anonymous", summary } : { action: "adopt" };
}

/**
 * Připíše data v telefonu účtu. Zůstatek z doby před peněženkou
 * na serveru jde do fronty jako počáteční stav — teprve teď je jasné,
 * komu patří.
 */
export async function adoptDevice(userId: string, now = new Date()): Promise<void> {
  const timestamp = now.toISOString();
  const database = db();
  await database.transaction("rw", database.profile, database.outbox, async () => {
    const current = (await database.profile.get(PROFILE_ID)) ?? emptyProfile(now);
    const { opening, ...rest } = current;
    if (opening && (opening.pills > 0 || opening.freezes > 0)) {
      await database.outbox.add({
        uid: `opening:${eventUid()}`,
        type: "wallet",
        payload: { kind: "opening", pills: opening.pills, freezes: opening.freezes, reason: "opening" },
        createdAt: timestamp,
      });
    }
    await database.profile.put({ ...rest, ownerId: userId, updatedAt: timestamp });
  });
}

/**
 * Klíče v localStorage, které patří účtu, ne zařízení. Jazyk, zvuk,
 * souhlas s podmínkami a nabídky instalace zůstávají.
 */
const ACCOUNT_KEYS = [
  "miligram:duelResults",
  "miligram:weekSeen",
  "miligram:badgesPublished",
  "miligram:prefsSynced",
] as const;

/**
 * Vyčistí telefon: lekce, odpovědi, zůstatek, rozehranou lekci, frontu,
 * dary, výhry i odznaky. S `ownerId` rovnou založí prázdný profil
 * pro účet, ke kterému se student přihlásil.
 */
export async function wipeDevice(ownerId?: string, now = new Date()): Promise<void> {
  const database = db();
  await database.transaction("rw", database.tables, async () => {
    await Promise.all(database.tables.map((table) => table.clear()));
    await database.profile.put({ ...emptyProfile(now), ...(ownerId ? { ownerId } : {}) });
  });
  for (const key of ACCOUNT_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Bez úložiště není co mazat.
    }
  }
  clearTones();
  clearPulse();
  forgetRemoteQueries();
}
