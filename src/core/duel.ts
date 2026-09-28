import { DIFFICULTY_RAMP } from "./lessonPlan";
import { CATEGORIES, type Category, type Difficulty } from "./types";

/**
 * Pravidla souboje.
 *
 * Totéž pravidlo stojí v databázi (migrace 0016, `duel_outcome`) — server
 * rozhoduje, kdo vyhrál, aplikace to potřebuje vědět dřív, než se ozve,
 * a ukázat proč. Test hlídá, že se obě strany shodnou na krajních
 * případech.
 */

/** Lhůta na přijetí výzvy a po přijetí na dohrání. */
export const DUEL_WINDOW_MS = 48 * 3600 * 1000;

/**
 * Odměna za souboj v pastilkách. XP ne: dva kamarádi by se vyzývali
 * dokola a nafoukli si ligu. Lekce souboje sama dá běžné XP.
 * Bezchybná remíza dá víc než obyčejná: oba spočítali všechno, a to je
 * výsledek, o který jde.
 */
export const DUEL_WIN_PILLS = 15;
export const DUEL_DRAW_PILLS = 5;
export const DUEL_FLAWLESS_DRAW_PILLS = 10;

export const DUEL_TOPICS = ["mix", ...CATEGORIES] as const;
export type DuelTopic = (typeof DUEL_TOPICS)[number];

export function isDuelTopic(value: string): value is DuelTopic {
  return (DUEL_TOPICS as readonly string[]).includes(value);
}

/**
 * Předvybrané téma výzvy: kategorie, ze které bylo příkladů nejvíc
 * (při shodě ta, která přišla dřív). Mix se nepředvybírá nikdy — vypadal
 * jako výchozí nastavení, které se nechá být, a téma se přehlíželo.
 * Konkrétní téma, které student zná, vyvolá otázku „chci zrovna tohle?“.
 */
export function mainCategory(categories: readonly (Category | null)[]): Category | null {
  const counts = new Map<Category, number>();
  for (const category of categories) if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  // Mapa drží pořadí prvního výskytu, takže při shodě zůstane dřívější.
  let best: Category | null = null;
  for (const [category, count] of counts) if (best === null || count > counts.get(best)!) best = category;
  return best;
}

export type DuelScore = {
  /** Příklady správně napoprvé bez nápovědy. */
  points: number;
  /** Značky po příkladech. Chybí u výsledků ze starší verze. */
  items?: readonly DuelMark[] | null;
};

/**
 * Značka prvního pokusu na příkladu, pro odhalení po příkladech.
 * Nápověda je vlastní značka: bod nedá, ale chyba to nebyla.
 */
export type DuelMark = "ok" | "miss" | "hint";

export type Outcome = "won" | "lost" | "draw";

/** Příklad bez bodu: pořadí v souboji a jeho obtížnost. */
type Miss = { index: number; difficulty: Difficulty };

/**
 * Příklady bez bodu, od nejlehčího. Nápověda se počítá jako chyba:
 * soupeř ji vidí jen jako „bez bodu“ a jiné pravidlo by prozradilo,
 * co z toho byla chyba.
 */
function misses(items: readonly DuelMark[]): Miss[] {
  return items
    .map((mark, index) => ({ mark, index, difficulty: DIFFICULTY_RAMP[index % DIFFICULTY_RAMP.length] }))
    .filter(({ mark }) => mark !== "ok")
    .map(({ index, difficulty }) => ({ index, difficulty }))
    .sort((a, b) => a.difficulty - b.difficulty || a.index - b.index);
}

export type DuelDecision = {
  outcome: Outcome;
  /**
   * Rozhodla při shodě bodů chyba: příklad, ve kterém chyboval poražený,
   * a čí byl. Chybí, když rozhodly body nebo je remíza.
   */
  decisive?: Miss & { mine: boolean };
};

/**
 * Jak dopadl souboj pro prvního z dvojice.
 *
 * Rozhodují body. Při shodě se porovnají chyby od nejlehčí a prohraje
 * ten, jehož chyba byla v lehčím příkladu: nepozornost v rutinním výpočtu
 * je u lůžka nebezpečnější než zaváhání ve složitém. Čas nerozhoduje,
 * jde o správnost.
 *
 * Totéž pravidlo stojí v migraci 0016 (`duel_outcome`), srovnání polí
 * v Postgresu: po prvcích, a když je jedno začátkem druhého, kratší
 * je menší. Při shodě bodů mají obě pole stejnou délku, ale kopíruje se
 * to, ať se strany nerozejdou ani jinde.
 */
export function duelDecision(mine: DuelScore, theirs: DuelScore): DuelDecision {
  if (mine.points !== theirs.points) return { outcome: mine.points > theirs.points ? "won" : "lost" };
  if (!mine.items || !theirs.items) return { outcome: "draw" };
  const a = misses(mine.items);
  const b = misses(theirs.items);
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (a[index].difficulty === b[index].difficulty) continue;
    return a[index].difficulty > b[index].difficulty
      ? { outcome: "won", decisive: { ...b[index], mine: false } }
      : { outcome: "lost", decisive: { ...a[index], mine: true } };
  }
  if (a.length === b.length) return { outcome: "draw" };
  return { outcome: a.length > b.length ? "won" : "lost" };
}

/** Jak dopadl souboj pro prvního z dvojice. */
export function duelOutcome(mine: DuelScore, theirs: DuelScore): Outcome {
  return duelDecision(mine, theirs).outcome;
}

export type DuelAttempt = {
  seed: string;
  correct: boolean;
  hinted: boolean;
};

/**
 * Skóre souboje z pokusů v lekci. Počítá se jen první pokus na každém
 * příkladu: opakování je v lekci na učení, v souboji by z chyby udělalo
 * druhou šanci.
 */
export function duelScore(
  seeds: readonly string[],
  attempts: readonly DuelAttempt[],
): { points: number; items: DuelMark[] } {
  let points = 0;
  const items: DuelMark[] = [];
  for (const seed of seeds) {
    const first = attempts.find((attempt) => attempt.seed === seed);
    const mark: DuelMark = !first ? "miss" : first.hinted ? "hint" : first.correct ? "ok" : "miss";
    items.push(mark);
    if (mark === "ok") points += 1;
  }
  return { points, items };
}

/**
 * Pastilky za rozhodnutý souboj. Remíza, ve které mám všechno správně,
 * je bezchybná i u soupeře, protože body se shodují.
 */
export function duelPills(outcome: Outcome, mine?: { points: number; count: number } | null): number {
  if (outcome === "won") return DUEL_WIN_PILLS;
  if (outcome === "lost") return 0;
  return mine && mine.points === mine.count ? DUEL_FLAWLESS_DRAW_PILLS : DUEL_DRAW_PILLS;
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

/**
 * Jak si stojím s kamarádem, pro řadu monogramů. Jeden otevřený souboj
 * na dvojici (migrace 0010), takže stačí najít ten.
 *
 * - `incoming` — vyzval mě, čeká se na přijetí
 * - `myTurn` — mám hrát (vyzval jsem a ještě nehrál, nebo po přijetí)
 * - `waiting` — odehráno nebo vyzváno, čeká se na kamaráda
 * - `free` — nic neběží, dá se vyzvat
 */
export type FriendDuelState = "incoming" | "myTurn" | "waiting" | "free";

export function friendDuelState(
  duels: readonly (DuelFacts & { opponentId: string })[],
  friendId: string,
): FriendDuelState {
  const open = duels.find(
    (duel) => duel.opponentId === friendId && (duel.status === "offered" || duel.status === "accepted"),
  );
  if (!open) return "free";
  const phase = duelPhase(open);
  if (phase === "incoming") return "incoming";
  if (phase === "myTurn" || (phase === "outgoing" && !open.playedByMe)) return "myTurn";
  return "waiting";
}

/** Pořadí v řadě: nejdřív kde mám něco udělat já, pak volní, čekající nakonec. */
export const FRIEND_DUEL_ORDER: Record<FriendDuelState, number> = { incoming: 0, myTurn: 1, free: 2, waiting: 3 };

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
