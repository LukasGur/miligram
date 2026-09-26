import { CATEGORIES, type Category } from "./types";

/**
 * Pravidla souboje.
 *
 * Totéž pravidlo stojí v databázi (migrace 0010, `duel_outcome`) — server
 * rozhoduje, kdo vyhrál, aplikace to potřebuje vědět dřív, než se ozve,
 * a ukázat proč. Test hlídá, že se obě strany shodnou na krajních
 * případech.
 */

/** Lhůta na přijetí výzvy a po přijetí na dohrání. */
export const DUEL_WINDOW_MS = 48 * 3600 * 1000;

/** Při shodě bodů rozhoduje čas, ale rozdíl pod sekundu je remíza. */
export const DUEL_TIE_MS = 1000;

/**
 * Odměna za souboj v pastilkách. XP ne: dva kamarádi by se vyzývali
 * dokola a nafoukli si ligu. Lekce souboje sama dá běžné XP.
 */
export const DUEL_WIN_PILLS = 15;
export const DUEL_DRAW_PILLS = 5;

/**
 * Jeden příklad se do času započítá nejvýš takhle dlouho. Kdo odejde
 * od rozehraného souboje na oběd, neměl by prohrát o hodinu — ani
 * vyhrát, když soupeř udělal totéž.
 */
export const DUEL_ITEM_CAP_MS = 10 * 60 * 1000;

export const DUEL_TOPICS = ["mix", ...CATEGORIES] as const;
export type DuelTopic = (typeof DUEL_TOPICS)[number];

export function isDuelTopic(value: string): value is DuelTopic {
  return (DUEL_TOPICS as readonly string[]).includes(value);
}

export type DuelScore = {
  /** Příklady správně napoprvé bez nápovědy. */
  points: number;
  /** Součet času prvních pokusů. Chybí u výsledků ze starší verze. */
  durationMs: number | null;
};

/**
 * Značka prvního pokusu na příkladu, pro odhalení po příkladech.
 * Nápověda je vlastní značka: bod nedá, ale chyba to nebyla.
 */
export type DuelMark = "ok" | "miss" | "hint";

export type Outcome = "won" | "lost" | "draw";

/** Jak dopadl souboj pro prvního z dvojice. */
export function duelOutcome(mine: DuelScore, theirs: DuelScore): Outcome {
  if (mine.points !== theirs.points) return mine.points > theirs.points ? "won" : "lost";
  if (mine.durationMs === null || theirs.durationMs === null) return "draw";
  const difference = theirs.durationMs - mine.durationMs;
  if (difference >= DUEL_TIE_MS) return "won";
  if (-difference >= DUEL_TIE_MS) return "lost";
  return "draw";
}

/** Rozhodlo se časem? Shrnutí to říká větou, jinak by výhra 6 : 6 nedávala smysl. */
export function decidedByTime(mine: DuelScore, theirs: DuelScore): boolean {
  return mine.points === theirs.points && duelOutcome(mine, theirs) !== "draw";
}

export type DuelAttempt = {
  seed: string;
  correct: boolean;
  hinted: boolean;
  /** Jak dlouho pokus trval, od zobrazení příkladu po vyhodnocení. */
  elapsedMs?: number;
};

/**
 * Skóre souboje z pokusů v lekci. Počítá se jen první pokus na každém
 * příkladu: opakování je v lekci na učení, v souboji by z chyby udělalo
 * druhou šanci.
 */
export function duelScore(
  seeds: readonly string[],
  attempts: readonly DuelAttempt[],
): DuelScore & { items: DuelMark[] } {
  let points = 0;
  let durationMs = 0;
  const items: DuelMark[] = [];
  for (const seed of seeds) {
    const first = attempts.find((attempt) => attempt.seed === seed);
    if (!first) {
      items.push("miss");
      continue;
    }
    const mark: DuelMark = first.hinted ? "hint" : first.correct ? "ok" : "miss";
    items.push(mark);
    if (mark === "ok") points += 1;
    durationMs += Math.min(Math.max(first.elapsedMs ?? 0, 0), DUEL_ITEM_CAP_MS);
  }
  return { points, durationMs: Math.round(durationMs), items };
}

/** Pastilky za rozhodnutý souboj. */
export function duelPills(outcome: Outcome): number {
  return outcome === "won" ? DUEL_WIN_PILLS : outcome === "draw" ? DUEL_DRAW_PILLS : 0;
}

export type DuelStatus = "offered" | "accepted" | "declined" | "expired" | "finished" | "void";

/**
 * Co se souboji děje z pohledu jednoho hráče. Podle toho se řadí seznam
 * a vybírá, jakou akci nabídnout.
 */
export type DuelPhase =
  /** Výzva pro mě, čeká na přijetí. */
  | "incoming"
  /** Moje výzva, druhý ji ještě nepřijal. */
  | "outgoing"
  /** Přijato, ještě jsem nehrál. */
  | "myTurn"
  /** Přijato, odehráno, čeká se na druhého. */
  | "waiting"
  | "finished"
  /** Odmítnuto, propadlo, nebo nikdo nedohrál. Nepočítá se. */
  | "void";

export type DuelFacts = {
  status: DuelStatus;
  challengedByMe: boolean;
  playedByMe: boolean;
};

export function duelPhase({ status, challengedByMe, playedByMe }: DuelFacts): DuelPhase {
  switch (status) {
    case "offered":
      if (!challengedByMe) return "incoming";
      return "outgoing";
    case "accepted":
      return playedByMe ? "waiting" : "myTurn";
    case "finished":
      return "finished";
    default:
      return "void";
  }
}

/** Kdy běžící lhůta skončí. Rozhodnutý souboj lhůtu nemá. */
export function duelDeadline(duel: {
  status: DuelStatus;
  createdAt: string;
  acceptedAt: string | null;
}): Date | null {
  if (duel.status === "offered") return new Date(Date.parse(duel.createdAt) + DUEL_WINDOW_MS);
  if (duel.status === "accepted" && duel.acceptedAt) {
    return new Date(Date.parse(duel.acceptedAt) + DUEL_WINDOW_MS);
  }
  return null;
}

/** Smí hráč souboj hrát? Vyzývající hned, vyzvaný až po přijetí. A jen jednou. */
export function canPlayDuel(facts: DuelFacts): boolean {
  const phase = duelPhase(facts);
  if (phase === "myTurn") return true;
  return phase === "outgoing" && !facts.playedByMe;
}

/** Kategorie tématu, nebo null pro mix. */
export function topicCategory(topic: DuelTopic): Category | null {
  return topic === "mix" ? null : topic;
}
