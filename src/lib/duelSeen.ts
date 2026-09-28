"use client";

import type { Duel } from "./remote";

/**
 * Výsledky soubojů, které uživatel už viděl.
 *
 * Kdo dohraje souboj první, výsledek nezná: rozhodne se až u soupeře.
 * Profil mu ho proto ukáže jednou, celoobrazovkově, jako konec týdne.
 * Kdo dohrál druhý, viděl výsledek hned po lekci (DuelReveal) a ten
 * se poznamená tam.
 *
 * Drží se v localStorage: je to pohodlí zařízení, ne data. Na druhém
 * telefonu se výsledek ukáže znovu, a to nevadí.
 */
const KEY = "miligram:duelSeen";
const KEEP = 100;

export type SeenState = {
  userId: string;
  /** Souboje rozhodnuté dřív se neukazují: nová instalace nemá dohánět historii. */
  since: string;
  seen: string[];
};

function read(): SeenState | null {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "null") as SeenState | null;
  } catch {
    return null;
  }
}

function write(state: SeenState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Bez úložiště se výsledek ukáže znovu; nic horšího se nestane.
  }
}

/** Stav pro účet; jiný účet nebo první spuštění začíná od teď. */
function stateFor(userId: string, now: Date): SeenState {
  const current = read();
  if (current?.userId === userId) return current;
  const fresh = { userId, since: now.toISOString(), seen: [] };
  write(fresh);
  return fresh;
}

/** Rozhodnuté souboje, které uživatel ještě neviděl, od nejstaršího. */
export function pickUnseen(duels: readonly Duel[], state: SeenState): Duel[] {
  return duels
    .filter(
      (duel) =>
        duel.status === "finished" &&
        duel.resolvedAt !== null &&
        duel.resolvedAt >= state.since &&
        !state.seen.includes(duel.id),
    )
    .sort((a, b) => (a.resolvedAt ?? "").localeCompare(b.resolvedAt ?? ""));
}

export function unseenDuels(userId: string, duels: readonly Duel[], now = new Date()): Duel[] {
  return pickUnseen(duels, stateFor(userId, now));
}

export function markDuelSeen(userId: string, duelId: string, now = new Date()): void {
  const state = stateFor(userId, now);
  if (state.seen.includes(duelId)) return;
  write({ ...state, seen: [...state.seen, duelId].slice(-KEEP) });
}
