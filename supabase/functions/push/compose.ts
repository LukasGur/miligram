/**
 * Složení notifikace z řádku fronty.
 *
 * Čistá funkce bez Deno i bez Node API: běží v Edge Function a zároveň
 * ji testuje vitest (src/lib/__tests__/pushCompose.test.ts). Texty jsou
 * výtah z messages/*.json, parametry skládá databáze (migrace 0008).
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

export function compose(kind: PushKind, params: Params, tag: string, locale: string, seed: number): Notice {
  const lang: Locale = locale === "sk" ? "sk" : "cs";
  const messages = MESSAGES[lang];
  const values = prepare(kind, params, seed);

  const format = (key: keyof typeof messages) =>
    String(new IntlMessageFormat(messages[key], lang).format(values));

  const notice: Notice = {
    title: format(`${kind}Title` as keyof typeof messages),
    body: format(`${kind}Body` as keyof typeof messages),
    tag,
    url: TARGET[kind],
    kind,
  };

  if (kind === "streak" || kind === "lastChance") {
    notice.actions = [{ action: "lesson", title: format("actionLesson") }];
  }
  return notice;
}

/**
 * Hodnoty pro texty. Databáze posílá syrová čísla; co je z nich vidět
 * (zóna v lize, pořadí divize, obměna textu), se rozhoduje tady, aby
 * o znění rozhodovalo jedno místo.
 */
function prepare(kind: PushKind, params: Params, seed: number): Record<string, string | number> {
  const number = (key: string) => Number(params[key] ?? 0);
  const text = (key: string) => String(params[key] ?? "");

  switch (kind) {
    case "streak":
      return {
        days: number("days"),
        fresh: number("days") === 0 ? "yes" : "no",
        // Obměna podle řádku fronty: den ode dne jiná věta, ať připomínka
        // nezevšední. Pořadí je náhodné jen zdánlivě — dá se zopakovat.
        variant: ["a", "b", "c"][Math.abs(seed) % 3],
      };
    case "lastChance":
      return { days: number("days") };
    case "leagueLastDay": {
      const rank = number("rank");
      const size = number("size");
      const gap = number("gap");
      const safe = number("safe");
      // Sestup má přednost před honičkou o postup: kdo je dole, potřebuje
      // vědět, kolik ho dělí od bezpečí, ne od třetího místa.
      const zone = size >= ZONES_FROM && rank <= 3 ? "up" : safe > 0 ? "down" : gap > 0 ? "chase" : "other";
      return { rank, size, gap, safe, zone };
    }
    case "leagueResult":
      return {
        rank: number("rank"),
        size: number("size"),
        move: text("move") || "stay",
        tier: TOP_TIER + 1 - number("tier"),
      };
    case "duelFinished":
      return { handle: text("handle"), mine: number("mine"), theirs: number("theirs"), outcome: text("outcome") };
    case "duelPlayed":
      // Skóre soupeře je zapečetěné, dokud příjemce sám nedohraje.
      return { handle: text("handle"), stage: text("stage") === "offered" ? "offered" : "other" };
    case "duelForfeit":
      return { handle: text("handle"), outcome: text("outcome") === "won" ? "won" : "lost" };
    default:
      return { handle: text("handle") };
  }
}
