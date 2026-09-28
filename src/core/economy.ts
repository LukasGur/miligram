import { scoreLesson, type LessonKind, type LessonResult } from "./scoring";

/**
 * Ekonomika: pastilky a série.
 *
 * Pastilky jsou měna — utrácejí se za nápovědy, ochranu série a opravy.
 * V kódu a v databázi se jmenují `pills`: dřív se jim říkalo prášky
 * a přejmenovaly se jen texty a ikona, data zůstala.
 * XP je skóre a nedá se utratit; ta část je ve scoring.ts. Rozdělení má
 * důvod: kdyby se liga řadila podle pastilek, každá vzatá nápověda by
 * uživatele srazila v žebříčku a lidé by se vysvětlením vyhýbali.
 *
 * Částky jsou naše rozhodnutí, ne převzatá čísla; zdůvodnění je
 * v CLAUDE.md (Ekonomika). Všechny jsou schválně na jednom místě, aby se
 * daly změnit bez zásahu do zbytku aplikace.
 */
export const PILLS_PER_CORRECT = 2;
export const PILLS_FLAWLESS_BONUS = 10;

/** Nápověda odkryje první krok řešení. */
export const HINT_COST = 15;

/** Ochrana série pokryje jeden vynechaný den. */
export const STREAK_FREEZE_COST = 60;

/**
 * Ochrana série darovaná kamarádovi stojí polovinu. Darovat se má vyplatit
 * víc než kupovat sobě. Že si dva kamarádi mohou darovat navzájem, nevadí:
 * je to přesně chování, které má dar podpořit, a limit jednoho daru týdně
 * spolu se stropem zásoby drží úsporu v mezích.
 */
export const GIFT_FREEZE_COST = 30;

/**
 * Kolik ochran si jde držet naráz. Bez stropu by se dala série udržovat
 * donekonečna, aniž by se hrálo — a tím by přestala měřit, co má.
 */
export const MAX_STREAK_FREEZES = 2;

/**
 * Pastilky za založení účtu. Jednou na účet, připisuje je server
 * (claim_signup_bonus, migrace 0014) — test hlídá, že čísla souhlasí.
 * Víc není potřeba: nápověda u nového typu příkladu je zadarmo, takže
 * nováček pastilky na začátek nepotřebuje. Je to poděkování, ne zásoba.
 */
export const SIGNUP_BONUS = 30;

export type StreakState = {
  /** Počet dní v řadě, kdy uživatel dokončil aspoň jednu lekci. */
  days: number;
  /** Den poslední dokončené lekce, ISO ve tvaru YYYY-MM-DD. */
  lastDay: string | null;
  /** Kolik zbývá koupených ochran proti vynechanému dni. */
  freezes: number;
};

/** Dnešek jako YYYY-MM-DD v místním čase — série se počítá podle kalendáře uživatele. */
export function localDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function previousDay(day: string): string {
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
  if (state.lastDay === previousDay(today)) return { ...state, days: state.days + 1, lastDay: today };

  /**
   * Vynechaný den. Ochrana ho pokryje, ale jen jeden a jen tehdy, když
   * uživatel přišel hned nazítří — po týdnu mlčení už není co chránit.
   */
  const missedOneDay = state.lastDay !== null && state.lastDay === previousDay(previousDay(today));
  if (missedOneDay && state.freezes > 0) {
    return { days: state.days + 1, lastDay: today, freezes: state.freezes - 1 };
  }
  return { ...state, days: 1, lastDay: today };
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
  // Koupená ochrana drží sérii naživu i den po vynechání — teprve pak
  // se ukáže, jestli ji uživatel využije, nebo o sérii přijde.
  if (state.freezes > 0 && state.lastDay === previousDay(previousDay(today))) return state.days;
  return 0;
}

/**
 * Série složená z historie: dny s lekcí a dny, které podržela ochrana.
 *
 * Stejné pravidlo jako `advanceStreak`, jen naráz: pokrytý den řadu
 * nepřeruší, ale nepřičte se. Obnova na novém telefonu bez pokrytých dní
 * sérii po každé použité ochraně zkrátila na jedničku.
 */
export function streakFromDays(
  lessonDays: readonly string[],
  coveredDays: readonly string[] = [],
): { days: number; lastDay: string | null } {
  const played = new Set(lessonDays);
  const covered = new Set(coveredDays);
  const sorted = [...played].sort();
  const lastDay = sorted.at(-1) ?? null;
  if (lastDay === null) return { days: 0, lastDay: null };

  let days = 0;
  for (let day = lastDay; played.has(day) || covered.has(day); day = previousDay(day)) {
    if (played.has(day)) days += 1;
  }
  return { days, lastDay };
}

export type LessonReward = LessonResult & { pills: number };

export function rewardForLesson(answers: readonly boolean[], kind: LessonKind = "lesson"): LessonReward {
  const result = scoreLesson(answers, kind);
  return {
    ...result,
    pills: result.correct * PILLS_PER_CORRECT + (result.flawless && kind === "lesson" ? PILLS_FLAWLESS_BONUS : 0),
  };
}
