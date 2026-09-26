"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BADGES,
  evaluateBadges,
  longestRun,
  mergeLevels,
  newlyEarned,
  parseBadgeLevels,
  type BadgeFacts,
  type BadgeState,
} from "@/core/badges";
import { MASTERY_MIN_ANSWERS, MASTERY_MIN_RATE, STAGES, masteredStages } from "@/core/curriculum";
import { duelOutcome, duelPhase, duelPills } from "@/core/duel";
import { localDay } from "@/core/economy";
import { LESSON_LENGTH } from "@/core/lessonPlan";
import { CATEGORIES } from "@/core/types";
import { categoryScores } from "./curriculum";
import { creditDuelReward, db, PROFILE_ID, saveBadgeLevels, storedBadgeLevels } from "./db";
import { publishBadges, recordDuelResult, type Duel, type DuelResult } from "./remote";

/* ---------------------------------------------------------------------------
   Pozvánky

   Odkaz nese přezdívku v adrese. Na Androidu ho nainstalovaná aplikace
   obvykle zachytí sama; na iPhonu se otevře v Safari, které přihlášení
   z plochy nevidí — proto se pozvánka dá zkopírovat a vložit v aplikaci.
   ------------------------------------------------------------------------ */

export const INVITE_PARAM = "pritel";
const HANDLE = /^[a-z0-9_]{3,20}$/;

export function inviteUrl(handle: string, origin = window.location.origin): string {
  return `${origin}/?${INVITE_PARAM}=${encodeURIComponent(handle)}`;
}

/** Přezdívka z odkazu, z textu se zkopírovaným odkazem, nebo holá přezdívka. */
export function parseInvite(text: string): string | null {
  const trimmed = text.trim();
  const fromUrl = trimmed.match(new RegExp(`[?&]${INVITE_PARAM}=([A-Za-z0-9_]{3,20})`));
  const candidate = (fromUrl?.[1] ?? trimmed).toLowerCase();
  return HANDLE.test(candidate) ? candidate : null;
}

/* ---------------------------------------------------------------------------
   Souboje
   ------------------------------------------------------------------------ */

/**
 * Připíše pastilky za rozhodnuté souboje, které tohle zařízení ještě
 * nevidělo. Kdo vyhrál, řekl server; tady se jen vybere částka.
 */
export async function collectDuelRewards(userId: string, duels: readonly Duel[]): Promise<void> {
  for (const duel of duels) {
    if (duel.status !== "finished") continue;
    const outcome = duel.winnerId === null ? "draw" : duel.winnerId === userId ? "won" : "lost";
    await creditDuelReward({ id: duel.id, resolvedAt: duel.resolvedAt }, duelPills(outcome));
  }
}

/** Jak souboj dopadl pro přihlášeného. Null, dokud není rozhodnutý. */
export function outcomeFor(userId: string, duel: Duel): "won" | "lost" | "draw" | null {
  if (duel.status !== "finished") return null;
  if (duel.winnerId === null) {
    // Server remízu zapíše jako prázdného vítěze. Kdyby se klient a server
    // rozešli (starší verze), rozhoduje server.
    return "draw";
  }
  return duel.winnerId === userId ? "won" : "lost";
}

/** Odhad, jak by dopadl souboj podle výsledků, které má klient v ruce. */
export function localOutcome(duel: Duel): "won" | "lost" | "draw" | null {
  if (!duel.mine || !duel.theirs) return null;
  return duelOutcome(duel.mine, duel.theirs);
}

/** Kolik soubojů čeká na akci uživatele: výzva k přijetí, nebo jeho tah. */
export function duelsNeedingMe(duels: readonly Duel[]): number {
  return duels.filter((duel) => {
    const phase = duelPhase(duel);
    return phase === "incoming" || phase === "myTurn";
  }).length;
}

/* Výsledek souboje, který se nepodařilo odeslat (bez sítě). Zkusí se znovu. */
const PENDING_KEY = "miligram:duelResults";

type PendingResults = Record<string, DuelResult & { userId: string }>;

function readPending(): PendingResults {
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? "{}") as PendingResults;
  } catch {
    return {};
  }
}

function writePending(value: PendingResults) {
  try {
    if (Object.keys(value).length === 0) window.localStorage.removeItem(PENDING_KEY);
    else window.localStorage.setItem(PENDING_KEY, JSON.stringify(value));
  } catch {
    // Bez úložiště se výsledek zkusí jen jednou.
  }
}

/**
 * Odešle výsledek souboje. Nejdřív se zapíše stranou, takže výpadek sítě
 * ho nespolkne — SyncAgent ho pošle, až se síť vrátí.
 */
export async function submitDuelResult(
  client: SupabaseClient,
  userId: string,
  duelId: string,
  result: DuelResult,
): Promise<void> {
  writePending({ ...readPending(), [duelId]: { ...result, userId } });
  await flushDuelResults(client, userId);
}

export async function flushDuelResults(client: SupabaseClient, userId: string): Promise<void> {
  const pending = readPending();
  for (const [duelId, result] of Object.entries(pending)) {
    if (result.userId !== userId) continue;
    try {
      // false = server výsledek odmítl (lhůta minula); nemá cenu to opakovat.
      await recordDuelResult(client, duelId, userId, result);
      const rest = readPending();
      delete rest[duelId];
      writePending(rest);
    } catch {
      return;
    }
  }
}

/* ---------------------------------------------------------------------------
   Odznaky
   ------------------------------------------------------------------------ */

export type RemoteBadgeFacts = Pick<BadgeFacts, "promoted" | "reachedTopLeague" | "wonWeek" | "duelWins" | "giftsSent">;

const UNKNOWN_REMOTE: RemoteBadgeFacts = {
  promoted: null,
  reachedTopLeague: null,
  wonWeek: null,
  duelWins: null,
  giftsSent: null,
};

/** Fakta, která zná zařízení samo. */
export async function localBadgeFacts(): Promise<Omit<BadgeFacts, keyof RemoteBadgeFacts>> {
  const database = db();
  const [profile, lessons, solved, scores] = await Promise.all([
    database.profile.get(PROFILE_ID),
    database.lessons.toArray(),
    database.answers.filter((answer) => answer.correct).count(),
    categoryScores(),
  ]);

  const days = lessons.map((lesson) => localDay(new Date(lesson.finishedAt)));
  const strong = CATEGORIES.filter((category) => {
    const score = scores.get(category);
    return score !== undefined && score.answered >= MASTERY_MIN_ANSWERS && score.correct / score.answered >= MASTERY_MIN_RATE;
  }).length;

  return {
    streak: Math.max(profile?.streakDays ?? 0, longestRun(days)),
    // Celá lekce: opakování chyb bývá jediný příklad a „bez chyby“ by
    // se z něj dalo nasbírat za minutu.
    flawlessLessons: lessons.filter((lesson) => lesson.flawless && lesson.count >= LESSON_LENGTH).length,
    solved,
    masteredStages: masteredStages(scores).size,
    totalStages: STAGES.length,
    strongCategories: strong,
    totalCategories: CATEGORIES.length,
  };
}

/** Stav všech odznaků; uloží nově dosažené stupně. */
export async function badgeStates(remote: RemoteBadgeFacts = UNKNOWN_REMOTE): Promise<BadgeState[]> {
  const [local, stored] = await Promise.all([localBadgeFacts(), storedBadgeLevels()]);
  const states = evaluateBadges({ ...local, ...remote }, stored);
  await saveBadgeLevels(mergeLevels(states, stored));
  return states;
}

/**
 * Odznaky, které přibyly teď — pro moment ve shrnutí lekce. Jen ty, které
 * jdou získat i bez účtu; ligové a soubojové se ukážou v profilu.
 */
export async function freshLocalBadges(): Promise<BadgeState[]> {
  const [local, stored] = await Promise.all([localBadgeFacts(), storedBadgeLevels()]);
  const states = evaluateBadges({ ...local, ...UNKNOWN_REMOTE }, stored);
  const local_ = new Set(BADGES.filter((badge) => badge.local).map((badge) => badge.id));
  const fresh = newlyEarned(states, stored).filter((state) => local_.has(state.id));
  await saveBadgeLevels(mergeLevels(states, stored));
  return fresh;
}

const BADGES_PUBLISHED = "miligram:badgesPublished";

/**
 * Pošle na server dosažené stupně odznaků, když se od minula změnily.
 * Kamarádi je vidí v profilu; úspěšnost, ze které některé vznikly, ne.
 */
export async function publishBadgesIfChanged(client: SupabaseClient, userId: string): Promise<void> {
  const levels = parseBadgeLevels(await storedBadgeLevels());
  const stamp = `${userId}:${JSON.stringify(levels)}`;
  let published: string | null = null;
  try {
    published = localStorage.getItem(BADGES_PUBLISHED);
  } catch {
    // Bez úložiště se pošle pokaždé; je to jeden malý zápis.
  }
  if (published === stamp) return;
  await publishBadges(client, userId, levels);
  try {
    localStorage.setItem(BADGES_PUBLISHED, stamp);
  } catch {
    // Viz výše.
  }
}
