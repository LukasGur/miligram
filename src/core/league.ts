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

/**
 * Číslo divize, jak se ukazuje uživateli.
 *
 * V databázi je 1 nejnižší divize a 5 nejvyšší, protože postup je pak
 * prosté zvýšení o jedna. Česky i slovensky je ale „první liga" ta
 * nejvyšší, takže se pro zobrazení pořadí obrací. Kdyby se to nedělalo,
 * hráč by po postupu viděl vyšší číslo a rozuměl tomu jako sestupu.
 */
export function displayTier(tier: number): number {
  return TOP_TIER + 1 - tier;
}

/** Od kolika lidí ve skupině se postupuje a sestupuje. Stejně jako migrace 0005. */
export const ZONES_FROM = PROMOTED + RELEGATED + 1;

/**
 * Kolik XP chybí na postup, nebo do bezpečí ze sestupové zóny. Null,
 * když se o tom nemá co říkat: v malé skupině se nepostupuje a kdo
 * v zóně už je (nebo mimo ni), nic nedohání.
 *
 * Remíza v XP rozhoduje přezdívkou (rankLeague), takže „o jedno víc“
 * je jistota, ne naděje.
 */
export function leagueGap(
  rows: readonly RankedEntry[],
  userId: string,
): { kind: "promote" | "safety"; xp: number } | null {
  if (rows.length < ZONES_FROM) return null;
  const me = rows.find((row) => row.userId === userId);
  if (!me) return null;

  if (me.zone === "relegate") {
    const lastSafe = rows[rows.length - RELEGATED - 1];
    return { kind: "safety", xp: Math.max(lastSafe.xp - me.xp + 1, 1) };
  }
  if (me.zone === null) {
    const third = rows[PROMOTED - 1];
    return { kind: "promote", xp: Math.max(third.xp - me.xp + 1, 1) };
  }
  return null;
}

/**
 * Konec ligového týdne: pondělí 00:00 místního času po daném okamžiku.
 * Server počítá týden v pražském čase; v ČR i SR je to totéž.
 */
export function weekEndsAt(now: Date): Date {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const daysToMonday = (8 - end.getDay()) % 7 || 7;
  end.setDate(end.getDate() + daysToMonday);
  return end;
}
