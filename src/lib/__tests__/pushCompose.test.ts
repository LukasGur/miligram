import { describe, expect, it } from "vitest";
import cs from "../../../messages/cs.json";
import sk from "../../../messages/sk.json";
import { compose, type PushKind } from "../../../supabase/functions/push/compose.ts";
import { MESSAGES } from "../../../supabase/functions/push/messages.ts";

/**
 * Texty notifikací skládá Edge Function z výtahu messages/*.json.
 * Tady se hlídá, že se výtah nerozešel se zdrojem a že každý druh
 * zprávy jde v obou jazycích vysázet bez zbytků šablony.
 */
const SAMPLES: [PushKind, Record<string, string | number>][] = [
  ["streak", { days: 12 }],
  ["streak", { days: 0 }],
  ["lastChance", { days: 5 }],
  ["duelChallenge", { handle: "petra" }],
  ["duelPlayed", { handle: "petra", correct: 6, count: 7 }],
  ["duelFinished", { handle: "petra", mine: 7, theirs: 5, outcome: "won" }],
  ["duelFinished", { handle: "petra", mine: 4, theirs: 5, outcome: "lost" }],
  ["duelFinished", { handle: "petra", mine: 5, theirs: 5, outcome: "draw" }],
  ["friendRequest", { handle: "petra" }],
  ["friendAccepted", { handle: "petra" }],
  ["gift", { handle: "petra" }],
  ["leagueLastDay", { rank: 2, size: 20, gap: 0 }],
  ["leagueLastDay", { rank: 6, size: 20, gap: 30 }],
  ["leagueLastDay", { rank: 2, size: 4, gap: 0 }],
  ["leagueResult", { rank: 1, size: 20, move: "up", tier: 2 }],
  ["leagueResult", { rank: 18, size: 20, move: "down", tier: 1 }],
  ["leagueResult", { rank: 9, size: 20, move: "stay", tier: 1 }],
];

describe("texty notifikací", () => {
  it("výtah pro Edge Function odpovídá messages (spusť scripts/build-push-messages.mjs)", () => {
    expect(MESSAGES.cs).toEqual(cs.push);
    expect(MESSAGES.sk).toEqual(sk.push);
  });

  it("obě jazykové sady mají stejné klíče", () => {
    expect(Object.keys(sk.push).sort()).toEqual(Object.keys(cs.push).sort());
  });

  it("každý druh jde vysázet v obou jazycích", () => {
    for (const locale of ["cs", "sk"]) {
      for (const [kind, params] of SAMPLES) {
        const notice = compose(kind, params, "tag", locale, 1);
        const label = `${locale}/${kind}/${JSON.stringify(params)}`;
        expect(notice.title, label).toBeTruthy();
        expect(notice.body, label).toBeTruthy();
        expect(`${notice.title} ${notice.body}`, label).not.toMatch(/[{}#]/);
      }
    }
  });

  it("série se skloňuje", () => {
    expect(compose("streak", { days: 1 }, "s", "cs", 0).title).toBe("1 den v kuse 🔥");
    expect(compose("streak", { days: 3 }, "s", "cs", 0).title).toBe("3 dny v kuse 🔥");
    expect(compose("streak", { days: 12 }, "s", "cs", 0).title).toBe("12 dní v kuse 🔥");
    expect(compose("streak", { days: 3 }, "s", "sk", 0).title).toBe("3 dni po sebe 🔥");
    expect(compose("streak", { days: 0 }, "s", "cs", 0).title).toBe("Dnešní dávka čeká 💊");
  });

  it("připomínka série se obměňuje a nabízí rovnou lekci", () => {
    const bodies = new Set([0, 1, 2].map((seed) => compose("streak", { days: 4 }, "s", "cs", seed).body));
    expect(bodies.size).toBe(3);
    const notice = compose("streak", { days: 4 }, "s", "cs", 0);
    expect(notice.url).toBe("/?lesson=daily");
    expect(notice.actions?.[0]).toEqual({ action: "lesson", title: "Spustit lekci" });
  });

  it("liga ukazuje divizi tak, jak ji vidí uživatel", () => {
    // Uvnitř je 5 nejvyšší divize, v rozhraní 1. (src/core/league.ts)
    expect(compose("leagueResult", { rank: 1, size: 20, move: "up", tier: 5 }, "l", "cs", 0).body).toContain("1. divizi");
  });

  it("v malé skupině se o postupu nemluví", () => {
    expect(compose("leagueLastDay", { rank: 1, size: 4, gap: 0 }, "l", "cs", 0).body).toBe("Jsi 1. z 4. Dnes ještě můžeš přidat.");
  });

  it("neznámý jazyk dostane češtinu", () => {
    expect(compose("gift", { handle: "a" }, "g", "de", 0).title).toBe("Dárek! 🎁");
  });
});
