/**
 * Pořadí v týdenní lize.
 *
 * Řazení a zóny jsou tady, ne v dotazu: je to pravidlo hry, ne detail
 * databáze, a chce si ho ohlídat testem. Server rozhoduje o postupu
 * a sestupu podle téhož pravidla — proto musí sedět obě strany.
 */

/** Nejvyšší divize. Musí souhlasit s omezením v migraci 0004. */
export const TOP_TIER = 5;
export const PROMOTED = 3;
export const RELEGATED = 5;

export type LeagueEntry = { userId: string; handle: string; xp: number };

export type RankedEntry = LeagueEntry & {
  rank: number;
  /** Postupová nebo sestupová zóna, je-li skupina dost velká. */
  zone: "promote" | "relegate" | null;
};

export function rankLeague(entries: readonly LeagueEntry[]): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => b.xp - a.xp || a.handle.localeCompare(b.handle));

  /**
   * Zóny se kreslí, jen když má skupina dost lidí. V osmičlenné skupině by
   * postupová a sestupová zóna zabraly celý seznam a nezůstalo by místo,
   * kde se dá jen tak být.
   */
  const zoned = sorted.length > PROMOTED + RELEGATED;

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    zone: !zoned
      ? null
      : index < PROMOTED
        ? "promote"
        : index >= sorted.length - RELEGATED
          ? "relegate"
          : null,
  }));
}
