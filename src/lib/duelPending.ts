"use client";

import type { DuelResult } from "./remote";

/**
 * Výsledky soubojů, které telefon zná a server ještě ne.
 *
 * Výsledek se zapíše sem hned po poslední odpovědi a teprve pak odchází
 * na server; bez sítě tu počká (src/lib/social.ts, flushDuelResults).
 * Zároveň se z něj skládá, co ukazuje obrazovka: dohraný souboj je dohraný
 * už ve chvíli, kdy student odpoví na poslední příklad, ne až když server
 * potvrdí zápis. Dřív profil po dohrání ukazoval „tvůj tah“, protože četl
 * jen server.
 */
const PENDING_KEY = "miligram:duelResults";

export type PendingResults = Record<string, DuelResult & { userId: string }>;

export function readPending(): PendingResults {
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? "{}") as PendingResults;
  } catch {
    return {};
  }
}

export function writePending(value: PendingResults): void {
  try {
    if (Object.keys(value).length === 0) window.localStorage.removeItem(PENDING_KEY);
    else window.localStorage.setItem(PENDING_KEY, JSON.stringify(value));
  } catch {
    // Bez úložiště se výsledek zkusí jen jednou.
  }
}

/** Souboj doplněný o vlastní výsledek, který ještě čeká na odeslání. */
export function withPendingResult<T extends { id: string; playedByMe: boolean; mine: DuelResult | null }>(
  duel: T,
  userId: string,
  pending: PendingResults = readPending(),
): T {
  const result = pending[duel.id];
  if (!result || result.userId !== userId || duel.mine) return duel;
  const mine: DuelResult = {
    correct: result.correct,
    count: result.count,
    points: result.points,
    durationMs: result.durationMs,
    items: result.items,
  };
  return { ...duel, playedByMe: true, mine };
}
