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

/**
 * Obnovení spadlé série. Schválně drahé — asi osm lekcí bez chyby: má
 * zachránit dlouhou sérii po nešťastném dni, ne nahradit docházku.
 * Proto jen u série aspoň týden dlouhé, jen krátce po ztrátě a nejvýš
 * jednou za třicet dní. Meze hlídá i server (migrace 0015).
 */
export const REPAIR_COST = 200;
export const REPAIR_MIN_STREAK = 7;
export const REPAIR_COOLDOWN_DAYS = 30;
/** Nejvýš tolik vynechaných dní jde obnovit — víc už není „krátce po ztrátě“. */
export const REPAIR_MAX_MISSED = 2;

export type StreakState = {
  /** Počet dní v řadě, kdy uživatel dokončil aspoň jednu lekci. */
  days: number;
  /** Den poslední dokončené lekce, ISO ve tvaru YYYY-MM-DD. */
  lastDay: string | null;
  /** Kolik zbývá koupených ochran proti vynechanému dni. */
  freezes: number;
  /**
   * Dny pokryté ochranou nebo obnovou. Řadu nepřeruší, ale nepřičtou se —
   * série za ně sahá dál, než je poslední lekce.
   */
  covered?: readonly string[];
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

export function nextDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
}

/** Posun o n dní (i dozadu). */
export function addDays(day: string, count: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + count)).toISOString().slice(0, 10);
}

/**
 * Kam až série sahá: den poslední lekce a za ním dny pokryté ochranou
 * nebo obnovou. Obnovená série „dojede“ až ke včerejšku, i když poslední
 * lekce byla předevčírem.
 */
export function streakThrough(lastDay: string | null, covered: readonly string[] = []): string | null {
  if (lastDay === null || covered.length === 0) return lastDay;
  const set = new Set(covered);
  let day = lastDay;
  while (set.has(nextDay(day))) day = nextDay(day);
  return day;
}

/**
 * Posun série po dokončené lekci.
 *
 * Druhá lekce v týž den sérii nezvyšuje — jinak by se dala natáhnout
 * za jediný večer a přestala by měřit to, co má měřit.
 */
export function advanceStreak(state: StreakState, today = localDay()): StreakState {
  if (state.lastDay === today) return state;
  const through = streakThrough(state.lastDay, state.covered);
  if (through === previousDay(today)) return { ...state, days: state.days + 1, lastDay: today };

  /**
   * Vynechaný den. Ochrana ho pokryje, ale jen jeden a jen tehdy, když
   * uživatel přišel hned nazítří — po týdnu mlčení už není co chránit.
   */
  const missedOneDay = through !== null && through === previousDay(previousDay(today));
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
  const through = streakThrough(state.lastDay, state.covered);
  if (through === null) return 0;
  if (through >= previousDay(today)) return state.days;
  // Koupená ochrana drží sérii naživu i den po vynechání — teprve pak
  // se ukáže, jestli ji uživatel využije, nebo o sérii přijde.
  if (state.freezes > 0 && through === previousDay(previousDay(today))) return state.days;
  return 0;
}

export type RepairOffer = {
  /** Kolik dní měla série, která spadla. */
  lost: number;
  /** Vynechané dny, které obnovení pokryje. */
  missing: string[];
  /** Poslední den, kdy se obnovit dá. */
  until: string;
};

/**
 * Dá se spadlá série obnovit?
 *
 * Dvě situace. Student se vrátil a ještě nehrál: série stojí na nule
 * a chybí jeden nebo dva dny. Nebo už zase hrál a série začala znovu
 * od jedničky — obnovení pak spojí starou řadu s novou. V obou je lhůta
 * stejná: do konce druhého dne po ztrátě.
 */
export function repairOffer(input: {
  lessonDays: readonly string[];
  coveredDays?: readonly string[];
  freezes: number;
  /** Den posledního placeného obnovení, YYYY-MM-DD. */
  lastRepair?: string | null;
  today?: string;
}): RepairOffer | null {
  const { lessonDays, coveredDays = [], freezes, lastRepair, today = localDay() } = input;
  if (lessonDays.length === 0) return null;
  if (lastRepair && addDays(lastRepair, REPAIR_COOLDOWN_DAYS) > today) return null;

  const played = new Set(lessonDays);
  const covered = new Set(coveredDays);
  const inStreak = (day: string) => played.has(day) || covered.has(day);
  const last = [...played].sort().at(-1)!;
  const through = streakThrough(last, coveredDays)!;

  let end: string;
  let missing: string[];
  if (through < previousDay(today)) {
    // Ještě nehrál: chybí dny od konce řady po včerejšek.
    missing = daysBetween(nextDay(through), previousDay(today));
    // Jediný vynechaný den podrží ochrana sama, jakmile se odehraje lekce.
    if (freezes > 0 && missing.length === 1) return null;
    end = through;
  } else {
    // Už hrál: najít mezeru před současnou řadou.
    let start = through;
    while (inStreak(previousDay(start))) start = previousDay(start);
    const before = [...played, ...covered].filter((day) => day < start).sort().at(-1);
    if (before === undefined) return null;
    missing = daysBetween(nextDay(before), previousDay(start));
    end = before;
  }

  if (missing.length === 0 || missing.length > REPAIR_MAX_MISSED) return null;
  // Série spadla s prvním dnem, který nic nepokrylo; lhůta běží do konce
  // druhého dne potom.
  const until = addDays(missing[0], 2);
  if (today > until) return null;

  const lost = streakFromDays(
    lessonDays.filter((day) => day <= end),
    coveredDays.filter((day) => day <= end),
  ).days;
  return lost >= REPAIR_MIN_STREAK ? { lost, missing, until } : null;
}

/** Dny od–do včetně. Prázdné, když je začátek za koncem. */
function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = nextDay(day)) days.push(day);
  return days;
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

/**
 * Nejdelší dřívější série — všechny řady kromě té poslední.
 *
 * Pro notifikaci o rekordu: kdyby se počítala i současná řada, byl by
 * při první sérii rekord každý den. Takhle přijde jen jednou, v den,
 * kdy se současná řada dotáhne na dosavadní maximum. Počítání je stejné
 * jako u `streakFromDays`: pokrytý den řadu nepřeruší, ale nepřičte se.
 */
export function previousBest(lessonDays: readonly string[], coveredDays: readonly string[] = []): number {
  const played = new Set(lessonDays);
  const days = [...new Set([...lessonDays, ...coveredDays])].sort();
  const runs: number[] = [];
  let run = 0;
  for (let i = 0; i < days.length; i += 1) {
    if (i > 0 && days[i] !== nextDay(days[i - 1])) {
      runs.push(run);
      run = 0;
    }
    if (played.has(days[i])) run += 1;
  }
  return runs.length === 0 ? 0 : Math.max(...runs);
}

export type LessonReward = LessonResult & { pills: number };

export function rewardForLesson(answers: readonly boolean[], kind: LessonKind = "lesson"): LessonReward {
  const result = scoreLesson(answers, kind);
  return {
    ...result,
    pills: result.correct * PILLS_PER_CORRECT + (result.flawless && kind === "lesson" ? PILLS_FLAWLESS_BONUS : 0),
  };
}
