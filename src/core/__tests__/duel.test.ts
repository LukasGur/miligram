import { describe, expect, it } from "vitest";
import {
  DUEL_ITEM_CAP_MS,
  DUEL_TOPICS,
  canPlayDuel,
  decidedByTime,
  duelDeadline,
  duelOutcome,
  duelPhase,
  duelPills,
  duelScore,
} from "../duel";
import { CATEGORIES } from "../types";

describe("výsledek souboje", () => {
  it("rozhodují body", () => {
    expect(duelOutcome({ points: 6, durationMs: 900_000 }, { points: 5, durationMs: 1_000 })).toBe("won");
    expect(duelOutcome({ points: 4, durationMs: 1_000 }, { points: 5, durationMs: 900_000 })).toBe("lost");
  });

  it("při shodě bodů vyhraje kratší čas", () => {
    const mine = { points: 6, durationMs: 252_000 };
    const theirs = { points: 6, durationMs: 290_000 };
    expect(duelOutcome(mine, theirs)).toBe("won");
    expect(duelOutcome(theirs, mine)).toBe("lost");
    expect(decidedByTime(mine, theirs)).toBe(true);
  });

  it("rozdíl pod sekundu je remíza", () => {
    expect(duelOutcome({ points: 6, durationMs: 250_000 }, { points: 6, durationMs: 250_999 })).toBe("draw");
    expect(duelOutcome({ points: 6, durationMs: 250_000 }, { points: 6, durationMs: 251_000 })).toBe("won");
  });

  it("výsledek ze starší verze bez času končí při shodě remízou", () => {
    expect(duelOutcome({ points: 5, durationMs: null }, { points: 5, durationMs: 1 })).toBe("draw");
  });

  it("odměna jen v pastilkách: výhra 15, remíza 5, prohra nic", () => {
    expect(duelPills("won")).toBe(15);
    expect(duelPills("draw")).toBe(5);
    expect(duelPills("lost")).toBe(0);
  });
});

describe("skóre z pokusů", () => {
  const seeds = ["a", "b", "c"];

  it("počítá jen první pokus a nápověda bod nedá", () => {
    const score = duelScore(seeds, [
      { seed: "a", correct: true, hinted: false, elapsedMs: 30_000 },
      { seed: "b", correct: false, hinted: false, elapsedMs: 40_000 },
      { seed: "c", correct: true, hinted: true, elapsedMs: 50_000 },
      // oprava druhého příkladu se nepočítá ani do bodů, ani do času
      { seed: "b", correct: true, hinted: false, elapsedMs: 10_000 },
    ]);
    expect(score).toEqual({ points: 1, durationMs: 120_000, items: ["ok", "miss", "hint"] });
  });

  it("jeden příklad se do času započítá nejvýš deset minut", () => {
    const score = duelScore(["a"], [{ seed: "a", correct: true, hinted: false, elapsedMs: 3_600_000 }]);
    expect(score.durationMs).toBe(DUEL_ITEM_CAP_MS);
  });
});

describe("fáze souboje", () => {
  it("výzva: vyzvaný přijímá, vyzývající smí hrát hned", () => {
    expect(duelPhase({ status: "offered", challengedByMe: false, playedByMe: false })).toBe("incoming");
    expect(duelPhase({ status: "offered", challengedByMe: true, playedByMe: false })).toBe("outgoing");
    expect(canPlayDuel({ status: "offered", challengedByMe: true, playedByMe: false })).toBe(true);
    expect(canPlayDuel({ status: "offered", challengedByMe: true, playedByMe: true })).toBe(false);
    expect(canPlayDuel({ status: "offered", challengedByMe: false, playedByMe: false })).toBe(false);
  });

  it("po přijetí hraje ten, kdo ještě nehrál", () => {
    expect(duelPhase({ status: "accepted", challengedByMe: false, playedByMe: false })).toBe("myTurn");
    expect(duelPhase({ status: "accepted", challengedByMe: true, playedByMe: true })).toBe("waiting");
  });

  it("odmítnuté, propadlé a nedohrané se nepočítají", () => {
    for (const status of ["declined", "expired", "void"] as const) {
      expect(duelPhase({ status, challengedByMe: true, playedByMe: true })).toBe("void");
    }
  });

  it("lhůta běží 48 hodin od výzvy, po přijetí znovu od přijetí", () => {
    expect(duelDeadline({ status: "offered", createdAt: "2026-09-26T10:00:00Z", acceptedAt: null })?.toISOString()).toBe(
      "2026-09-28T10:00:00.000Z",
    );
    expect(
      duelDeadline({ status: "accepted", createdAt: "2026-09-26T10:00:00Z", acceptedAt: "2026-09-27T08:00:00Z" })?.toISOString(),
    ).toBe("2026-09-29T08:00:00.000Z");
    expect(duelDeadline({ status: "finished", createdAt: "2026-09-26T10:00:00Z", acceptedAt: null })).toBeNull();
  });

  it("témata souhlasí s omezením v migraci 0010", () => {
    expect(DUEL_TOPICS).toEqual(["mix", ...CATEGORIES]);
  });
});

describe("shoda s databází", () => {
  it("migrace 0010 počítá s toutéž lhůtou a hranicí remízy", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/0010_souboje_pravidla.sql", "utf8");
    expect(sql).toContain("when b_ms - a_ms >= 1000 then 1");
    expect(sql).toContain("interval '48 hours'");
    for (const topic of DUEL_TOPICS) expect(sql).toContain(`'${topic}'`);
  });
});
