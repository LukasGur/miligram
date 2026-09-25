import type { LessonPlan } from "./lessonPlan";

/**
 * Průběh lekce: co předložit dál.
 *
 * Lekce není hotová po sedmi odpovědích, ale po sedmi uzavřených
 * příkladech. Kdo se splete, dostane tentýž typ výpočtu — s jinými čísly —
 * znovu na konci, a lekce končí, až je všechno správně. Sedm chyb ze sedmi
 * proto nemůže znamenat splněný denní cíl.
 *
 * Uvíznout ale nejde: kdo se splete podruhé, může si nechat ukázat celý
 * postup a jít dál. Vzdaný příklad se nevrací a do denního cíle se
 * nepočítá — do statistik ano, takže se vrátí jindy v opakování chyb.
 *
 * Všechno se odvozuje z pokusů v pořadí, v jakém padly. Díky tomu stačí
 * uložit pokusy a pořadí se po návratu do rozehrané lekce dopočítá samo —
 * není co držet vedle v paměti a co by se mohlo rozejít.
 */
export type Attempt = {
  /** Semínko určuje příklad; v rámci lekce je jedinečné. */
  seed: string;
  correct: boolean;
  /**
   * Student příklad vzdal: po druhé chybě si nechal ukázat celý postup
   * a šel dál. Bez téhle možnosti se v lekci uvízne — kdo látku nezná,
   * dostává tentýž příklad pořád dokola a lekci nedokončí nikdy.
   */
  gaveUp?: boolean;
};

/** Semínka příkladů, které už student vyřešil. */
export function solvedSeeds(attempts: readonly Attempt[]): Set<string> {
  return new Set(attempts.filter((attempt) => attempt.correct).map((attempt) => attempt.seed));
}

/** Semínka, která se v lekci už nevrátí: vyřešená i vzdaná. */
function closedSeeds(attempts: readonly Attempt[]): Set<string> {
  const closed = solvedSeeds(attempts);
  for (const attempt of attempts) if (attempt.gaveUp) closed.add(attempt.seed);
  return closed;
}

/** Kolikátý pokus na příkladu student právě má. Podle toho se nabídne vzdání. */
export function attemptsOn(attempts: readonly Attempt[], seed: string): number {
  return attempts.filter((attempt) => attempt.seed === seed).length;
}

/**
 * Který příklad předložit. `null` znamená, že je lekce hotová.
 *
 * Nejdřív se projde plán v pořadí. Teprve když nezbývá nic nezkoušeného,
 * přijdou na řadu chyby — a to v pořadí, v jakém padly, ne v pořadí
 * plánu. Kdo se splete ve druhém a pátém příkladu, dostane po sedmičce
 * znovu druhý a pak pátý.
 */
export function nextIndex(plan: LessonPlan, attempts: readonly Attempt[]): number | null {
  const closed = closedSeeds(attempts);
  const lastAttempt = new Map<string, number>();
  attempts.forEach((attempt, order) => lastAttempt.set(attempt.seed, order));

  let candidate: { index: number; order: number } | null = null;

  for (const [index, item] of plan.items.entries()) {
    if (closed.has(item.seed)) continue;

    const order = lastAttempt.get(item.seed);
    // Nezkoušený příklad má přednost před opravou: první průchod se
    // dokončí celý, teprve pak se sbírají chyby.
    if (order === undefined) return index;
    if (candidate === null || order < candidate.order) candidate = { index, order };
  }

  return candidate?.index ?? null;
}

/** Hotovo, když je vyřešený každý příklad z plánu. */
export function isFinished(plan: LessonPlan, attempts: readonly Attempt[]): boolean {
  return nextIndex(plan, attempts) === null;
}

/** Kolik příkladů z plánu je vyřešených. Tohle plní kruh denního cíle. */
export function solvedCount(plan: LessonPlan, attempts: readonly Attempt[]): number {
  const solved = solvedSeeds(attempts);
  return plan.items.filter((item) => solved.has(item.seed)).length;
}

/**
 * Jak dopadl první pokus u každého příkladu, v pořadí plánu.
 *
 * Z tohohle se počítá odměna: XP a prášky se dávají za to, že student
 * počítal správně, ne za to, že to nakonec doklepal. Opakování je na
 * učení, ne na sbírání bodů. Nezkoušený příklad se počítá jako chyba —
 * v dokončené lekci žádný takový není, ale nedohraná se tím nedá ohnout.
 */
export function firstTryOutcomes(plan: LessonPlan, attempts: readonly Attempt[]): boolean[] {
  const first = new Map<string, boolean>();
  for (const attempt of attempts) {
    if (!first.has(attempt.seed)) first.set(attempt.seed, attempt.correct);
  }
  return plan.items.map((item) => first.get(item.seed) === true);
}
