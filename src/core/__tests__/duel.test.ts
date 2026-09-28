import { describe, expect, it } from "vitest";
import {
  DUEL_TOPICS,
  canPlayDuel,
  duelDeadline,
  duelDecision,
  duelOutcome,
  duelPhase,
  duelPills,
  duelScore,
  mainCategory,
  friendDuelState,
} from "../duel";
import { DIFFICULTY_RAMP } from "../lessonPlan";
import { CATEGORIES } from "../types";

describe("výsledek souboje", () => {
  // Pořadí obtížností v souboji: 1, 1, 2, 2, 2, 3, 3.
  const marks = (misses: number[], hint: number[] = []) =>
    Array.from({ length: 7 }, (_, index) => (hint.includes(index) ? "hint" : misses.includes(index) ? "miss" : "ok")) as (
      | "ok"
      | "miss"
      | "hint"
    )[];
  const score = (misses: number[], hint: number[] = []) => ({
    points: 7 - misses.length - hint.length,
    items: marks(misses, hint),
  });

  it("rozhodují body, obtížnost chyb až při shodě", () => {
    // Jedna chyba v lehkém proti dvěma v těžkých: víc bodů vyhrává.
    expect(duelOutcome(score([0]), score([5, 6]))).toBe("won");
    expect(duelOutcome(score([5, 6]), score([0]))).toBe("lost");
  });

  it("při shodě bodů prohrává chyba v lehčím příkladu", () => {
    const easy = score([1]);
    const hard = score([6]);
    expect(duelOutcome(easy, hard)).toBe("lost");
    expect(duelOutcome(hard, easy)).toBe("won");
    expect(duelDecision(easy, hard).decisive).toEqual({ index: 1, difficulty: 1, mine: true });
    expect(duelDecision(hard, easy).decisive).toEqual({ index: 1, difficulty: 1, mine: false });
  });

  it("porovnává se od nejlehčí chyby, ne součet", () => {
    // 1 + 3 proti 2 + 2: součet stejný, ale nejlehčí chyba je lehká.
    expect(duelOutcome(score([0, 6]), score([2, 3]))).toBe("lost");
    // Nejlehčí chyby shodné, rozhodne další.
    expect(duelOutcome(score([0, 5]), score([1, 2]))).toBe("won");
  });

  it("stejně těžké chyby jsou remíza, i když jde o jiné příklady", () => {
    expect(duelDecision(score([0, 2]), score([1, 4]))).toEqual({ outcome: "draw" });
    expect(duelOutcome(score([]), score([]))).toBe("draw");
  });

  it("nápověda se počítá jako chyba", () => {
    expect(duelOutcome(score([], [0]), score([6]))).toBe("lost");
    expect(duelOutcome(score([], [3]), score([3]))).toBe("draw");
  });

  it("výsledek ze starší verze bez značek končí při shodě remízou", () => {
    expect(duelOutcome({ points: 5, items: null }, score([0, 1]))).toBe("draw");
    expect(duelOutcome({ points: 6 }, score([0, 1]))).toBe("won");
  });

  it("odměna jen v pastilkách: výhra 15, remíza 5, bez chyby 10, prohra nic", () => {
    expect(duelPills("won")).toBe(15);
    expect(duelPills("draw", { points: 5, count: 7 })).toBe(5);
    expect(duelPills("draw", { points: 7, count: 7 })).toBe(10);
    expect(duelPills("draw")).toBe(5);
    expect(duelPills("lost")).toBe(0);
  });
});

describe("skóre z pokusů", () => {
  it("počítá jen první pokus a nápověda bod nedá", () => {
    const score = duelScore(
      ["a", "b", "c", "d"],
      [
        { seed: "a", correct: true, hinted: false },
        { seed: "b", correct: false, hinted: false },
        { seed: "c", correct: true, hinted: true },
        // oprava druhého příkladu se nepočítá
        { seed: "b", correct: true, hinted: false },
      ],
    );
    expect(score).toEqual({ points: 1, items: ["ok", "miss", "hint", "miss"] });
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
  it("migrace 0010 počítá s toutéž lhůtou a tématy", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/0010_souboje_pravidla.sql", "utf8");
    expect(sql).toContain("interval '48 hours'");
    for (const topic of DUEL_TOPICS) expect(sql).toContain(`'${topic}'`);
  });

  it("migrace 0016 zná tentýž náběh obtížnosti a porovnává chyby", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/0016_souboj_bez_casu.sql", "utf8");
    expect(sql).toContain(`(array[${DIFFICULTY_RAMP.join(", ")}])[((i.ord - 1) % ${DIFFICULTY_RAMP.length}) + 1]`);
    expect(sql).toContain("when public.duel_miss_ramp(a_items) > public.duel_miss_ramp(b_items) then 1");
    expect(sql).toContain("where i.mark <> 'ok'");
  });
});

describe("předvybrané téma výzvy", () => {
  it("kategorie s nejvíc příklady, při shodě ta dřívější", () => {
    expect(mainCategory(["zaklad", "redeni", "redeni", "zaklad", "redeni", null])).toBe("redeni");
    expect(mainCategory(["zaklad", "redeni", "redeni", "zaklad"])).toBe("zaklad");
    expect(mainCategory([null])).toBeNull();
    expect(mainCategory([])).toBeNull();
  });
});

describe("stav souboje s kamarádem", () => {
  const duel = (status: "offered" | "accepted" | "finished", challengedByMe: boolean, playedByMe: boolean) => ({
    opponentId: "k",
    status,
    challengedByMe,
    playedByMe,
  });
  it("rozliší, kdo je na tahu", () => {
    expect(friendDuelState([], "k")).toBe("free");
    expect(friendDuelState([duel("finished", true, true)], "k")).toBe("free");
    expect(friendDuelState([duel("offered", false, false)], "k")).toBe("incoming");
    expect(friendDuelState([duel("offered", true, false)], "k")).toBe("myTurn");
    expect(friendDuelState([duel("offered", true, true)], "k")).toBe("waiting");
    expect(friendDuelState([duel("accepted", false, false)], "k")).toBe("myTurn");
    expect(friendDuelState([duel("accepted", false, true)], "k")).toBe("waiting");
    expect(friendDuelState([duel("offered", false, false)], "jiny")).toBe("free");
  });
});
