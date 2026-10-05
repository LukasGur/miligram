import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import cs from "../../../messages/cs.json";
import sk from "../../../messages/sk.json";
import { choose, compose, type PushKind, type Seed } from "../../../supabase/functions/push/compose.ts";
import { MESSAGES } from "../../../supabase/functions/push/messages.ts";

/**
 * Texty notifikací skládá Edge Function z výtahu messages/*.json.
 * Tady se hlídá, že se výtah nerozešel se zdrojem, že každá varianta
 * jde v obou jazycích vysázet bez zbytků šablony a že výběr situace
 * a obměna drží pravidla z compose.ts.
 */
const SEED: Seed = { user: "0b5c3a1e-7d2f-4c8a-9e61-3f2d1c0b9a87", day: 20_366 };

const SAMPLES: [PushKind, Record<string, string | number>][] = [
  ["streak", { days: 12, hour: 19, weekday: 2 }],
  ["streak", { days: 0 }],
  ["lastChance", { days: 5 }],
  ["duelChallenge", { handle: "petra" }],
  ["duelPlayed", { handle: "petra", stage: "offered" }],
  ["duelPlayed", { handle: "petra", stage: "accepted" }],
  ["duelAccepted", { handle: "petra" }],
  ["duelDeclined", { handle: "petra" }],
  ["duelExpiring", { handle: "petra" }],
  ["duelForfeit", { handle: "petra", outcome: "won" }],
  ["duelForfeit", { handle: "petra", outcome: "lost" }],
  ["duelFinished", { handle: "petra", mine: 7, theirs: 5, outcome: "won" }],
  ["duelFinished", { handle: "petra", mine: 4, theirs: 5, outcome: "lost" }],
  ["duelFinished", { handle: "petra", mine: 5, theirs: 5, outcome: "draw" }],
  ["friendRequest", { handle: "petra" }],
  ["friendAccepted", { handle: "petra" }],
  ["gift", { handle: "petra" }],
  ["leagueLastDay", { rank: 2, size: 20, gap: 0 }],
  ["leagueLastDay", { rank: 6, size: 20, gap: 30 }],
  ["leagueLastDay", { rank: 2, size: 4, gap: 0 }],
  ["leagueLastDay", { rank: 18, size: 20, gap: 90, safe: 20 }],
  ["leagueResult", { rank: 1, size: 20, move: "up", tier: 2 }],
  ["leagueResult", { rank: 18, size: 20, move: "down", tier: 1 }],
  ["leagueResult", { rank: 9, size: 20, move: "stay", tier: 1 }],
];

/** Všechny parametry, které se v textech vyskytují, s hodnotami na hraně. */
const EVERYTHING = {
  days: 3,
  next: 4,
  lost: 12,
  deadline: "today",
  handle: "petra",
  gap: 40,
  safe: 25,
  rank: 4,
  size: 12,
  tier: 3,
  mine: 6,
  theirs: 5,
};

const streak = (params: Record<string, string | number | null>, seed: Partial<Seed> = {}) =>
  choose("streak", params, { ...SEED, ...seed });

describe("texty notifikací", () => {
  it("výtah pro Edge Function odpovídá messages (spusť scripts/build-push-messages.mjs)", () => {
    expect(MESSAGES.cs).toEqual(cs.push);
    expect(MESSAGES.sk).toEqual(sk.push);
  });

  it("obě jazykové sady mají stejné varianty", () => {
    expect(Object.keys(sk.push.variants).sort()).toEqual(Object.keys(cs.push.variants).sort());
  });

  it("každá varianta jde vysázet v obou jazycích", () => {
    for (const locale of ["cs", "sk"] as const) {
      for (const [id, variant] of Object.entries(MESSAGES[locale].variants)) {
        for (const days of [1, 3, 7, 30]) {
          for (const message of [variant.title, variant.body]) {
            const text = String(new IntlMessageFormat(message, locale).format({ ...EVERYTHING, days }));
            expect(text, `${locale}/${id}`).not.toMatch(/[{}#]/);
          }
        }
      }
    }
  });

  it("každý druh jde vysázet v obou jazycích", () => {
    for (const locale of ["cs", "sk"]) {
      for (const [kind, params] of SAMPLES) {
        for (let day = 0; day < 12; day += 1) {
          const notice = compose(kind, params, "tag", locale, { ...SEED, day });
          const label = `${locale}/${kind}/${JSON.stringify(params)}/${day}`;
          expect(notice.title, label).toBeTruthy();
          expect(notice.body, label).toBeTruthy();
          expect(`${notice.title} ${notice.body}`, label).not.toMatch(/[{}#]/);
        }
      }
    }
  });

  it("v textech nejsou pomlčky ani tvary podle rodu", () => {
    // Rod příjemce ani soupeře neznáme, věty proto stojí v přítomném čase.
    const gendered = /\b(udělal|spočítal|vyzval|vyhrál|prohrál|hrál|zapomněl|neměl|myslel|dohrál)(a|i)?\b/i;
    for (const [id, variant] of Object.entries(MESSAGES.cs.variants)) {
      const text = `${variant.title} ${variant.body}`;
      expect(text, id).not.toMatch(gendered);
      expect(text, id).not.toMatch(/ [—–-] /);
    }
  });

  it("série se skloňuje", () => {
    const title = (days: number, locale = "cs") =>
      String(new IntlMessageFormat(MESSAGES[locale as "cs"].variants.V1.title, locale).format({ days }));
    expect(title(1)).toBe("1 den v kuse 🔥");
    expect(title(3)).toBe("3 dny v kuse 🔥");
    expect(title(12)).toBe("12 dní v kuse 🔥");
    expect(title(3, "sk")).toBe("3 dni po sebe 🔥");
  });

  it("připomínka série nabízí rovnou lekci", () => {
    const notice = compose("streak", { days: 4 }, "s", "cs", SEED);
    expect(notice.url).toBe("/?lesson=daily");
    expect(notice.actions?.[0]).toEqual({ action: "lesson", title: "Spustit lekci" });
  });

  it("liga ukazuje číslo ligy tak, jak ho vidí uživatel", () => {
    // Uvnitř je 5 nejvyšší liga, v rozhraní 1. (src/core/league.ts)
    for (let day = 0; day < 4; day += 1) {
      expect(compose("leagueResult", { rank: 1, size: 20, move: "up", tier: 5 }, "l", "cs", { ...SEED, day }).body).toMatch(/1\. (ligy|místo)/);
    }
    expect(compose("leagueResult", { rank: 1, size: 20, move: "up", tier: 5 }, "l", "cs", SEED).title + "").not.toContain("5.");
  });

  it("v sestupu se říká, kolik chybí do bezpečí", () => {
    for (let day = 0; day < 4; day += 1) {
      const notice = compose("leagueLastDay", { rank: 18, size: 20, gap: 90, safe: 20 }, "l", "cs", { ...SEED, day });
      expect(notice.body).toMatch(/[Dd]o bezpečí chybí 20 XP/);
    }
  });

  it("zpráva o odehraném souboji neprozradí skóre", () => {
    for (let day = 0; day < 6; day += 1) {
      for (const stage of ["accepted", "offered"]) {
        const notice = compose("duelPlayed", { handle: "petra", stage, correct: 6, count: 7 }, "d", "cs", { ...SEED, day });
        expect(`${notice.title} ${notice.body}`).not.toMatch(/\d/);
      }
    }
  });

  it("v malé skupině se o postupu nemluví", () => {
    for (let day = 0; day < 4; day += 1) {
      const body = compose("leagueLastDay", { rank: 1, size: 4, gap: 0 }, "l", "cs", { ...SEED, day }).body;
      expect(body).not.toMatch(/postup|padáš/);
    }
  });

  it("neznámý jazyk dostane češtinu", () => {
    expect(compose("gift", { handle: "a" }, "g", "de", SEED).body).toMatch(/ochran/);
  });

  it("klepnutí na zprávu o souboji vede na jeho kartu, ostatní tam, kam patří", () => {
    const id = "0b5c3a1e-7d2f-4c8a-9e61-3f2d1c0b9a87";
    expect(compose("duelChallenge", { handle: "petra" }, `duel:${id}`, "cs", SEED).url).toBe(`/?open=duels&duel=${id}`);
    expect(compose("duelFinished", { handle: "petra", mine: 7, theirs: 5, outcome: "won" }, `duel:${id}`, "cs", SEED).url).toBe(
      `/?open=duels&duel=${id}`,
    );
    expect(compose("friendRequest", { handle: "petra" }, "friend:x", "cs", SEED).url).toBe("/?open=account");
    expect(compose("leagueResult", { rank: 1, size: 10, tier: 3 }, "l", "cs", SEED).url).toBe("/?open=league");
  });
});

describe("výběr varianty", () => {
  it("den ode dne se jde po skupině dál a nic se neopakuje, dokud nedojde", () => {
    // Liché dny: texty podle denní doby, sudé: texty bez kontextu.
    const evening = [1, 3, 5, 7].map((day) => streak({ days: 12, hour: 19, weekday: 2 }, { day }));
    expect(new Set(evening).size).toBe(4);
    const anytime = Array.from({ length: 11 }, (_, i) => streak({ days: 12, hour: 19, weekday: 2 }, { day: i * 2 }));
    expect(new Set(anytime).size).toBe(11);
    expect(anytime.every((id) => id.startsWith("X"))).toBe(true);
  });

  it("dva příjemci nedostanou týž den stejnou větu (u větší skupiny)", () => {
    const users = ["a", "b", "c", "d", "e", "f"].map((user) => streak({ days: 12, hour: 19, weekday: 2 }, { user, day: 0 }));
    expect(new Set(users).size).toBeGreaterThan(1);
  });

  it("pořadí situací: obnova, milník, rekord", () => {
    expect(streak({ days: 0, lost: 12, deadline: "tomorrow" })).toMatch(/^O/);
    expect(streak({ days: 0 })).toMatch(/^N/);
    expect(streak({ days: 6, best: 6, duel: "petra" })).toMatch(/^M[12]$/);
    expect(streak({ days: 29 })).toMatch(/^M[34]$/);
    expect(streak({ days: 99 })).toMatch(/^M[56]$/);
    expect(streak({ days: 9, best: 9, duel: "petra" })).toMatch(/^R/);
  });

  it("rekord jen v den, kdy se série dotáhne na dřívější maximum", () => {
    expect(streak({ days: 9, best: 12 }, { day: 1 })).not.toMatch(/^R/);
    expect(streak({ days: 2, best: 2 }, { day: 1 })).not.toMatch(/^R/);
    // Starší aplikace rekord neposílá.
    expect(streak({ days: 9, best: null }, { day: 1 })).not.toMatch(/^R/);
  });

  it("souboj, liga a ochrana jen obden", () => {
    const params = { days: 12, duel: "petra", hour: 19, weekday: 2 };
    expect(streak(params, { day: 10 })).toMatch(/^D/);
    expect(streak(params, { day: 11 })).toMatch(/^V/);
  });

  it("víc situací naráz se střídá", () => {
    const params = { days: 12, duel: "petra", rank: 5, size: 20, gap: 40, safe: 0, freezes: 1 };
    const seen = new Set(Array.from({ length: 12 }, (_, i) => streak(params, { day: i * 2 })[0]));
    expect(seen).toEqual(new Set(["D", "L", "F"]));
  });

  it("liga v připomínce podle zóny", () => {
    expect(streak({ days: 12, rank: 2, size: 20, gap: 0, safe: 0 }, { day: 0 })).toMatch(/^L[56]$/);
    expect(streak({ days: 12, rank: 6, size: 20, gap: 40, safe: 0 }, { day: 0 })).toMatch(/^L[12]$/);
    expect(streak({ days: 12, rank: 18, size: 20, gap: 90, safe: 20 }, { day: 0 })).toMatch(/^L[34]$/);
    // Malá skupina zóny nemá, liga se nezmiňuje.
    expect(streak({ days: 12, rank: 2, size: 5, gap: 0, safe: 0 }, { day: 0 })).toMatch(/^X/);
  });

  it("o víkendu víkendové texty, ve všední den podle denní doby", () => {
    expect(streak({ days: 12, hour: 9, weekday: 6 }, { day: 1 })).toMatch(/^W/);
    expect(streak({ days: 12, hour: 9, weekday: 3 }, { day: 1 })).toMatch(/^A/);
    expect(streak({ days: 12, hour: 13, weekday: 3 }, { day: 1 })).toMatch(/^P/);
    expect(streak({ days: 12, hour: 19, weekday: 3 }, { day: 1 })).toMatch(/^V/);
  });

  it("věty „Série 3 dní…“ přijdou až od pěti dní", () => {
    for (let day = 0; day < 40; day += 1) {
      for (const hour of [9, 13, 19]) {
        const id = streak({ days: 3, hour, weekday: 3 }, { day });
        expect(["P1", "P4", "V3", "X5", "X8", "X11"]).not.toContain(id);
      }
      expect(["C2", "C7", "C8", "C10"]).not.toContain(choose("lastChance", { days: 3 }, { ...SEED, day }));
    }
  });

  it("poslední šance podle ochrany a délky série", () => {
    expect(choose("lastChance", { days: 12, freezes: 1 }, SEED)).toMatch(/^C[12]$/);
    expect(choose("lastChance", { days: 40 }, SEED)).toMatch(/^C[345]$/);
    expect(choose("lastChance", { days: 12 }, SEED)).toMatch(/^C([6-9]|10)$/);
  });

  it("remíza bez chyby má vlastní text", () => {
    expect(choose("duelFinished", { mine: 7, theirs: 7, outcome: "draw" }, SEED)).toMatch(/^FP/);
    expect(choose("duelFinished", { mine: 5, theirs: 5, outcome: "draw" }, SEED)).toMatch(/^FD/);
  });

  it("obnova říká, do kdy jde sérii zachránit", () => {
    const text = (deadline: string) =>
      compose("streak", { days: 0, lost: 12, deadline }, "s", "cs", { ...SEED, day: 0 }).body +
      compose("streak", { days: 0, lost: 12, deadline }, "s", "cs", { ...SEED, day: 1 }).body;
    expect(text("today")).toContain("dnešní půlnoci");
    expect(text("tomorrow")).toContain("zítřejší půlnoci");
  });

  it("v připomínce souboje stojí přezdívka soupeře", () => {
    const notice = compose("streak", { days: 12, duel: "petra" }, "s", "cs", { ...SEED, day: 10 });
    expect(`${notice.title} ${notice.body}`).toContain("petra");
  });
});
