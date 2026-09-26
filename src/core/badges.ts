/**
 * Odznaky.
 *
 * Každý stojí na datech, která aplikace nebo server už znají — nic se kvůli
 * nim nesbírá navíc. Stupňované odznaky (I/II/III) rostou, místo aby vedle
 * sebe stály tři podobné.
 *
 * Jednou získaný stupeň nemizí: série spadne, ale odznak za třicet dní
 * v kuse zůstává. Proto se nejvyšší dosažený stupeň ukládá na zařízení
 * a slučuje s tím, co vyjde z dnešních čísel (`mergeLevels`).
 */

export type BadgeId =
  | "streak"
  | "flawless"
  | "solved"
  | "promotion"
  | "topLeague"
  | "weekWinner"
  | "duelist"
  | "graduate"
  | "versatile"
  | "colleague";

export type BadgeFacts = {
  /** Nejdelší známá série ve dnech. */
  streak: number;
  /** Celé lekce bez chyby. */
  flawlessLessons: number;
  /** Spočítané příklady (i napodruhé). */
  solved: number;
  /** Aspoň jednou postup o ligu výš. Null, když to bez účtu nejde zjistit. */
  promoted: boolean | null;
  /** Aspoň jednou v nejvyšší lize. */
  reachedTopLeague: boolean | null;
  /** Aspoň jednou první ve skupině, kde se postupuje. */
  wonWeek: boolean | null;
  duelWins: number | null;
  masteredStages: number;
  totalStages: number;
  /** Kategorie aspoň s MASTERY_MIN_ANSWERS odpověďmi a úspěšností ≥ 80 %. */
  strongCategories: number;
  totalCategories: number;
  giftsSent: number | null;
};

type Definition = {
  id: BadgeId;
  /** Prahy stupňů. Jednostupňový odznak má jediný práh 1 (splněno / ne). */
  thresholds: readonly number[];
  /** Hodnota, se kterou se prahy porovnávají. Null = neznámá (bez účtu). */
  value: (facts: BadgeFacts) => number | null;
  /** Odznak jde odemknout i bez účtu. Ty se hlásí ve shrnutí lekce. */
  local: boolean;
  /**
   * Průběh u odznaku, který je splněno / nesplněno, ale má co počítat
   * (3 z 8 stupňů). Stupňované odznaky ho mají z prahů.
   */
  meter?: (facts: BadgeFacts) => { value: number; target: number };
};

const flag = (value: boolean | null) => (value === null ? null : value ? 1 : 0);

export const BADGES: readonly Definition[] = [
  { id: "streak", thresholds: [7, 30, 100], value: (f) => f.streak, local: true },
  { id: "flawless", thresholds: [1, 10, 50], value: (f) => f.flawlessLessons, local: true },
  { id: "solved", thresholds: [100, 500, 2000], value: (f) => f.solved, local: true },
  { id: "promotion", thresholds: [1], value: (f) => flag(f.promoted), local: false },
  { id: "topLeague", thresholds: [1], value: (f) => flag(f.reachedTopLeague), local: false },
  { id: "weekWinner", thresholds: [1], value: (f) => flag(f.wonWeek), local: false },
  { id: "duelist", thresholds: [1, 10, 50], value: (f) => f.duelWins, local: false },
  {
    id: "graduate",
    thresholds: [1],
    value: (f) => (f.totalStages > 0 && f.masteredStages >= f.totalStages ? 1 : 0),
    local: true,
    meter: (f) => ({ value: f.masteredStages, target: f.totalStages }),
  },
  {
    id: "versatile",
    thresholds: [1],
    value: (f) => (f.totalCategories > 0 && f.strongCategories >= f.totalCategories ? 1 : 0),
    local: true,
    meter: (f) => ({ value: f.strongCategories, target: f.totalCategories }),
  },
  { id: "colleague", thresholds: [5], value: (f) => f.giftsSent, local: false },
];

export type BadgeState = {
  id: BadgeId;
  /** Dosažený stupeň, 0 = zamčeno. */
  level: number;
  /** Kolik stupňů odznak má. */
  levels: number;
  /** Hodnota a cíl dalšího stupně, pro průběh. Null u hotového nebo neznámého. */
  progress: { value: number; target: number } | null;
};

function levelFor(thresholds: readonly number[], value: number): number {
  return thresholds.filter((threshold) => value >= threshold).length;
}

/**
 * Stav všech odznaků. `stored` jsou dříve dosažené stupně; vrací se vyšší
 * z obou, takže odznak nezmizí, když série spadne.
 */
export function evaluateBadges(
  facts: BadgeFacts,
  stored: Readonly<Partial<Record<BadgeId, number>>> = {},
): BadgeState[] {
  return BADGES.map((badge) => {
    const value = badge.value(facts);
    const reached = value === null ? 0 : levelFor(badge.thresholds, value);
    const level = Math.max(reached, stored[badge.id] ?? 0);
    const next = badge.thresholds[level];
    // Splněno / nesplněno: průběh jen tam, kde je co počítat.
    const binary = badge.thresholds.length === 1 && badge.thresholds[0] === 1;
    let progress: BadgeState["progress"] = null;
    if (next !== undefined && value !== null) {
      if (!binary) progress = { value: Math.min(value, next), target: next };
      else if (badge.meter) progress = badge.meter(facts);
    }
    return { id: badge.id, level, levels: badge.thresholds.length, progress };
  });
}

/** Stupně, které přibyly proti uloženým. Z nich je moment ve shrnutí lekce. */
export function newlyEarned(
  states: readonly BadgeState[],
  stored: Readonly<Partial<Record<BadgeId, number>>>,
): BadgeState[] {
  return states.filter((state) => state.level > (stored[state.id] ?? 0));
}

/** Uložené stupně po sloučení s novými. */
export function mergeLevels(
  states: readonly BadgeState[],
  stored: Readonly<Partial<Record<BadgeId, number>>>,
): Partial<Record<BadgeId, number>> {
  const merged: Partial<Record<BadgeId, number>> = { ...stored };
  for (const state of states) merged[state.id] = Math.max(state.level, stored[state.id] ?? 0);
  return merged;
}

export function isLocalBadge(id: BadgeId): boolean {
  return BADGES.find((badge) => badge.id === id)?.local ?? false;
}

/** Nejdelší řada po sobě jdoucích dní v seznamu dnů YYYY-MM-DD. */
export function longestRun(days: readonly string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of sorted) {
    const [year, month, date] = day.split("-").map(Number);
    const current = Date.UTC(year, month - 1, date) / 86_400_000;
    run = previous !== null && current - previous === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = current;
  }
  return best;
}

/**
 * Ligové odznaky z historie týdnů. `tier` je vnitřní číslo (1 nejnižší,
 * 5 nejvyšší, src/core/league.ts).
 */
export function leagueFacts(
  history: readonly { tier: number; rank: number; size: number }[],
  topTier: number,
  zonesFrom: number,
): { promoted: boolean; reachedTopLeague: boolean; wonWeek: boolean } {
  let promoted = false;
  for (let index = 1; index < history.length; index += 1) {
    if (history[index].tier > history[index - 1].tier) promoted = true;
  }
  return {
    promoted,
    reachedTopLeague: history.some((week) => week.tier >= topTier),
    wonWeek: history.some((week) => week.rank === 1 && week.size >= zonesFrom),
  };
}
