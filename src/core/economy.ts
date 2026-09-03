import { scoreLesson, type LessonResult } from "./scoring";

/**
 * Ekonomika: prášky a série.
 *
 * Prášky jsou měna — utrácejí se za nápovědy, ochranu série a opravy.
 * XP je skóre a nedá se utratit; ta část je ve scoring.ts. Rozdělení má
 * důvod: kdyby se liga řadila podle prášků, každá vzatá nápověda by
 * uživatele srazila v žebříčku a lidé by se vysvětlením vyhýbali.
 *
 * POZOR: konkrétní částky níže jsou návrh, ne převzatá čísla. Brief má
 * ekonomiku v sekci 6 a proti ní se musí ověřit. Všechny jsou schválně
 * na jednom místě, aby se daly změnit bez zásahu do zbytku aplikace.
 */
export const PILLS_PER_CORRECT = 2;
export const PILLS_FLAWLESS_BONUS = 10;

/** Nápověda odkryje první krok řešení. */
export const HINT_COST = 15;

export type StreakState = {
  /** Počet dní v řadě, kdy uživatel dokončil aspoň jednu lekci. */
  days: number;
  /** Den poslední dokončené lekce, ISO ve tvaru YYYY-MM-DD. */
  lastDay: string | null;
};

/** Dnešek jako YYYY-MM-DD v místním čase — série se počítá podle kalendáře uživatele. */
export function localDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  // Datum se skládá v UTC, aby posun letního času neubral ani nepřidal den.
  const previous = new Date(Date.UTC(year, month - 1, date - 1));
  return previous.toISOString().slice(0, 10);
}

/**
 * Posun série po dokončené lekci.
 *
 * Druhá lekce v týž den sérii nezvyšuje — jinak by se dala natáhnout
 * za jediný večer a přestala by měřit to, co má měřit.
 */
export function advanceStreak(state: StreakState, today = localDay()): StreakState {
  if (state.lastDay === today) return state;
  if (state.lastDay === previousDay(today)) return { days: state.days + 1, lastDay: today };
  return { days: 1, lastDay: today };
}

/**
 * Série, jak se má zobrazit dnes. Uložená hodnota může být zastaralá:
 * když uživatel den vynechá, série je nula, i když v databázi zůstalo číslo
 * z minula. Přepisovat databázi kvůli zobrazení není potřeba — stačí to
 * počítat při čtení.
 */
export function currentStreak(state: StreakState, today = localDay()): number {
  if (state.lastDay === null) return 0;
  if (state.lastDay === today || state.lastDay === previousDay(today)) return state.days;
  return 0;
}

export type LessonReward = LessonResult & { pills: number };

export function rewardForLesson(answers: readonly boolean[]): LessonReward {
  const result = scoreLesson(answers);
  return {
    ...result,
    pills: result.correct * PILLS_PER_CORRECT + (result.flawless ? PILLS_FLAWLESS_BONUS : 0),
  };
}
