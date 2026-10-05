/**
 * Složení notifikace z řádku fronty.
 *
 * Čistá funkce bez Deno i bez Node API: běží v Edge Function a zároveň
 * ji testuje vitest (src/lib/__tests__/pushCompose.test.ts). Texty jsou
 * výtah z messages/*.json, parametry skládá databáze (migrace 0008, 0018).
 *
 * Každý druh zprávy má podle situace skupinu variant. Která přijde,
 * se odvodí od příjemce a dne: den ode dne se jde po skupině dál, takže
 * se nic nezopakuje, dokud skupina nedojde, a dva kamarádi nedostanou
 * týž den stejnou větu. Texty jsou v messages/*.json pod `push.variants`.
 */
import { IntlMessageFormat } from "intl-messageformat";
import { MESSAGES } from "./messages.ts";

export type PushKind =
  | "streak"
  | "lastChance"
  | "duelChallenge"
  | "duelPlayed"
  | "duelFinished"
  | "duelAccepted"
  | "duelDeclined"
  | "duelExpiring"
  | "duelForfeit"
  | "friendRequest"
  | "friendAccepted"
  | "gift"
  | "leagueLastDay"
  | "leagueResult";

export type Locale = keyof typeof MESSAGES;
export type VariantId = keyof (typeof MESSAGES)["cs"]["variants"];

/** To, co dostane service worker. Tvar musí sedět se scripts/sw.template.js. */
export type Notice = {
  title: string;
  body: string;
  tag: string;
  url: string;
  kind: PushKind;
  actions?: { action: string; title: string }[];
};

type Params = Record<string, string | number | null | undefined>;

/**
 * Podle čeho se vybírá varianta: příjemce a den odeslání (dny od
 * 1. 1. 1970). Den ode dne o krok dál, každý příjemce z jiného místa.
 */
export type Seed = { user: string; day: number };

/**
 * Kam klepnutí vede. Souboje a liga mají vlastní obrazovku v profilu,
 * přátelé jsou na profilu samotném. Starší verze aplikace neznámý cíl
 * přejdou a otevřou domovskou obrazovku.
 */
const TARGET: Record<PushKind, string> = {
  streak: "/?lesson=daily",
  lastChance: "/?lesson=daily",
  duelChallenge: "/?open=duels",
  duelPlayed: "/?open=duels",
  duelFinished: "/?open=duels",
  duelAccepted: "/?open=duels",
  duelDeclined: "/?open=duels",
  duelExpiring: "/?open=duels",
  duelForfeit: "/?open=duels",
  friendRequest: "/?open=account",
  friendAccepted: "/?open=account",
  gift: "/",
  leagueLastDay: "/?open=league",
  leagueResult: "/?open=league",
};

/** Číslo ligy, jak ho vidí uživatel: 1 je nejvyšší (src/core/league.ts). */
const TOP_TIER = 5;

/** Postup, sestup a zóny platí jen ve skupině větší než 3 + 5 (migrace 0005). */
const ZONES_FROM = 9;

/** Dny série, za které je odznak (src/core/badges.ts). */
const MILESTONES: Record<number, VariantId[]> = {
  7: ["M1", "M2"],
  30: ["M3", "M4"],
  100: ["M5", "M6"],
};

/**
 * Věty typu „Série 3 dní…“ česky ani slovensky neobstojí, a skloňovat
 * je přes celou větu by zadání znečitelnilo. Takové varianty přijdou
 * až od pěti dní; do té doby se střídají ostatní.
 */
const FROM_FIVE_DAYS = new Set<VariantId>(["P1", "P4", "V3", "W1", "W4", "X5", "X8", "X11", "C2", "C7", "C8", "C10"]);

const POOLS = {
  repair: ["O1", "O2", "O3"],
  record: ["R1", "R2", "R3", "R4"],
  duel: ["D1", "D2"],
  leagueUp: ["L5", "L6"],
  leagueChase: ["L1", "L2"],
  leagueDown: ["L3", "L4"],
  freeze: ["F1", "F2", "F3"],
  fresh: ["N1", "N2", "N3", "N4", "N5"],
  morning: ["A1", "A2", "A3", "A4"],
  afternoon: ["P1", "P2", "P3", "P4"],
  evening: ["V1", "V2", "V3", "V4"],
  weekend: ["W1", "W2", "W3", "W4"],
  anytime: ["X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8", "X9", "X11", "X12"],
  lastFreeze: ["C1", "C2"],
  lastLong: ["C3", "C4", "C5"],
  lastChance: ["C6", "C7", "C8", "C9", "C10"],
  duelChallenge: ["DC1", "DC2", "DC3", "DC4"],
  duelPlayedOffered: ["PO1", "PO2", "PO3"],
  duelPlayed: ["PT1", "PT2", "PT3"],
  duelAccepted: ["DA1", "DA2", "DA3"],
  duelDeclined: ["DD1", "DD2", "DD3"],
  duelExpiring: ["DE1", "DE2", "DE3"],
  duelWon: ["FW1", "FW2", "FW3", "FW4"],
  duelLost: ["FL1", "FL2", "FL3"],
  duelDraw: ["FD1", "FD2"],
  duelPerfectDraw: ["FP1", "FP2"],
  forfeitWon: ["KW1", "KW2"],
  forfeitLost: ["KL1", "KL2"],
  friendRequest: ["FR1", "FR2", "FR3"],
  friendAccepted: ["FA1", "FA2", "FA3"],
  gift: ["G1", "G2", "G3"],
  lastDayUp: ["LD1", "LD2"],
  lastDayChase: ["LD3", "LD4"],
  lastDayDown: ["LD5", "LD6"],
  lastDayOther: ["LD7", "LD8"],
  resultUp: ["LR1", "LR2"],
  resultDown: ["LR3", "LR4"],
  resultStay: ["LR5", "LR6"],
} satisfies Record<string, VariantId[]>;

export function compose(kind: PushKind, params: Params, tag: string, locale: string, seed: Seed): Notice {
  const lang: Locale = locale === "sk" ? "sk" : "cs";
  const messages = MESSAGES[lang];
  const id = choose(kind, params, seed);
  const values = prepare(kind, params);

  const format = (message: string) => String(new IntlMessageFormat(message, lang).format(values));

  const notice: Notice = {
    title: format(messages.variants[id].title),
    body: format(messages.variants[id].body),
    tag,
    url: TARGET[kind],
    kind,
  };

  if (kind === "streak" || kind === "lastChance") {
    notice.actions = [{ action: "lesson", title: format(messages.actionLesson) }];
  }
  // Zpráva o konkrétním souboji otevře jeho kartu. Identifikátor nese
  // značka zprávy (`duel:<id>`, migrace 0008 a 0010).
  if (kind.startsWith("duel") && tag.startsWith("duel:")) {
    notice.url = `/?open=duels&duel=${encodeURIComponent(tag.slice("duel:".length))}`;
  }
  return notice;
}

/**
 * Která varianta přijde. Databáze posílá syrová čísla; co z nich plyne
 * (situace, zóna v lize, obměna textu), se rozhoduje tady, aby o znění
 * rozhodovalo jedno místo.
 */
export function choose(kind: PushKind, params: Params, seed: Seed): VariantId {
  const number = (key: string) => Number(params[key] ?? 0);
  const text = (key: string) => String(params[key] ?? "");
  const offset = hash(seed.user);
  const pick = (pool: readonly VariantId[], step = seed.day) => pool[(((step + offset) % pool.length) + pool.length) % pool.length];

  switch (kind) {
    case "streak":
      return chooseStreak(params, seed, offset);
    case "lastChance": {
      const days = number("days");
      const pool = number("freezes") > 0 ? POOLS.lastFreeze : days >= 30 ? POOLS.lastLong : POOLS.lastChance;
      return pick(byDays(pool, days));
    }
    case "duelChallenge":
      return pick(POOLS.duelChallenge);
    case "duelPlayed":
      return pick(text("stage") === "offered" ? POOLS.duelPlayedOffered : POOLS.duelPlayed);
    case "duelAccepted":
      return pick(POOLS.duelAccepted);
    case "duelDeclined":
      return pick(POOLS.duelDeclined);
    case "duelExpiring":
      return pick(POOLS.duelExpiring);
    case "duelFinished": {
      const outcome = text("outcome");
      if (outcome === "won") return pick(POOLS.duelWon);
      if (outcome === "lost") return pick(POOLS.duelLost);
      // Remíza 7 : 7 dává 10 pastilek místo pěti (src/core/duel.ts).
      return pick(number("mine") === 7 && number("theirs") === 7 ? POOLS.duelPerfectDraw : POOLS.duelDraw);
    }
    case "duelForfeit":
      return pick(text("outcome") === "won" ? POOLS.forfeitWon : POOLS.forfeitLost);
    case "friendRequest":
      return pick(POOLS.friendRequest);
    case "friendAccepted":
      return pick(POOLS.friendAccepted);
    case "gift":
      return pick(POOLS.gift);
    case "leagueLastDay": {
      const zone = leagueZone(params);
      return pick(
        zone === "up" ? POOLS.lastDayUp : zone === "down" ? POOLS.lastDayDown : zone === "chase" ? POOLS.lastDayChase : POOLS.lastDayOther,
      );
    }
    case "leagueResult": {
      const move = text("move");
      return pick(move === "up" ? POOLS.resultUp : move === "down" ? POOLS.resultDown : POOLS.resultStay);
    }
  }
}

/**
 * Denní připomínka. Platí první situace, která sedí:
 *
 * 1. spadlá série, kterou jde ještě obnovit,
 * 2. milník (dnešní lekce dá 7., 30. nebo 100. den),
 * 3. dnešní lekce překoná dřívější rekord,
 * 4.–6. souboj na tahu, liga, ochrana série — jen obden, jinak by
 *    kdo má pořád rozehraný souboj dostával pořád totéž,
 * 7. nová série,
 * 8. obecné: střídavě texty bez kontextu a texty podle denní doby
 *    (o víkendu víkendové).
 */
function chooseStreak(params: Params, seed: Seed, offset: number): VariantId {
  const number = (key: string) => Number(params[key] ?? 0);
  const days = number("days");
  const at = (pool: readonly VariantId[], step: number) => pool[(step + offset) % pool.length];

  if (days === 0) {
    if (number("lost") > 0) return at(POOLS.repair, seed.day);
    return at(POOLS.fresh, seed.day);
  }

  const milestone = MILESTONES[days + 1];
  if (milestone) return at(milestone, seed.day);

  // Dřívější rekord posílá telefon; starší verze aplikace ho neposílají.
  const best = params.best;
  if (best !== null && best !== undefined && days >= 3 && days === Number(best)) return at(POOLS.record, seed.day);

  const half = Math.floor(seed.day / 2);
  if (seed.day % 2 === 0) {
    const context: (readonly VariantId[])[] = [];
    if (params.duel) context.push(POOLS.duel);
    const zone = leagueZone(params);
    if (zone === "up") context.push(POOLS.leagueUp);
    if (zone === "chase") context.push(POOLS.leagueChase);
    if (zone === "down") context.push(POOLS.leagueDown);
    if (days >= 3 && number("freezes") > 0) context.push(POOLS.freeze);
    // Víc situací naráz se střídá, aby souboj nepřebil ligu napořád.
    if (context.length > 0) return at(context[(half + offset) % context.length], half);
    return at(byDays(POOLS.anytime, days), half);
  }

  const weekday = number("weekday");
  const hour = number("hour");
  const pool =
    weekday === 6 || weekday === 7 ? POOLS.weekend : hour < 11 ? POOLS.morning : hour < 17 ? POOLS.afternoon : POOLS.evening;
  return at(byDays(pool, days), half);
}

function byDays(pool: readonly VariantId[], days: number): readonly VariantId[] {
  if (days >= 5) return pool;
  const usable = pool.filter((id) => !FROM_FIVE_DAYS.has(id));
  return usable.length > 0 ? usable : pool;
}

/**
 * Zóna v lize. Sestup má přednost před honičkou o postup: kdo je dole,
 * potřebuje vědět, kolik ho dělí od bezpečí, ne od třetího místa.
 */
function leagueZone(params: Params): "up" | "chase" | "down" | "other" | null {
  if (params.rank === null || params.rank === undefined) return null;
  const rank = Number(params.rank);
  const size = Number(params.size ?? 0);
  if (size >= ZONES_FROM && rank <= 3) return "up";
  if (Number(params.safe ?? 0) > 0) return "down";
  if (Number(params.gap ?? 0) > 0) return "chase";
  return "other";
}

/** Hodnoty pro texty. */
function prepare(kind: PushKind, params: Params): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) values[key] = value;
  }
  if (kind === "streak" || kind === "lastChance") {
    values.days = Number(params.days ?? 0);
    values.next = values.days + 1;
    values.deadline = params.deadline === "today" ? "today" : "tomorrow";
    // Soupeř v rozehraném souboji (denní připomínka, varianty D).
    if (params.duel) values.handle = String(params.duel);
  }
  if (kind === "leagueResult") {
    values.tier = TOP_TIER + 1 - Number(params.tier ?? 0);
  }
  if (kind === "duelPlayed") {
    // Skóre soupeře je zapečetěné, dokud příjemce sám nedohraje.
    delete values.correct;
    delete values.count;
  }
  return values;
}

/** Krátký otisk identifikátoru příjemce (FNV-1a), vždy nezáporný. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 1000003;
}
