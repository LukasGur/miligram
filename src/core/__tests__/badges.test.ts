import { describe, expect, it } from "vitest";
import { evaluateBadges, leagueFacts, longestRun, mergeLevels, newlyEarned, type BadgeFacts } from "../badges";

const facts: BadgeFacts = {
  streak: 12,
  flawlessLessons: 6,
  solved: 448,
  promoted: true,
  reachedTopLeague: false,
  wonWeek: false,
  duelWins: 7,
  masteredStages: 3,
  totalStages: 8,
  strongCategories: 7,
  totalCategories: 12,
  giftsSent: 1,
};

const byId = (states: ReturnType<typeof evaluateBadges>) => Object.fromEntries(states.map((s) => [s.id, s]));

describe("odznaky", () => {
  it("stupňované rostou po prazích a ukazují cestu k dalšímu", () => {
    const states = byId(evaluateBadges(facts));
    expect(states.streak.level).toBe(1);
    expect(states.streak.progress).toEqual({ value: 12, target: 30 });
    expect(states.solved.level).toBe(1);
    expect(states.solved.progress).toEqual({ value: 448, target: 500 });
    expect(states.duelist.level).toBe(1);
  });

  it("splněno / nesplněno bez průběhu, pokud není co počítat", () => {
    const states = byId(evaluateBadges(facts));
    expect(states.promotion.level).toBe(1);
    expect(states.topLeague).toMatchObject({ level: 0, progress: null });
    expect(states.graduate).toMatchObject({ level: 0, progress: { value: 3, target: 8 } });
    expect(states.colleague.progress).toEqual({ value: 1, target: 5 });
  });

  it("bez účtu jsou ligové a soubojové zamčené, ne rozbité", () => {
    const states = byId(
      evaluateBadges({ ...facts, promoted: null, reachedTopLeague: null, wonWeek: null, duelWins: null, giftsSent: null }),
    );
    expect(states.duelist).toMatchObject({ level: 0, progress: null });
    expect(states.promotion.level).toBe(0);
  });

  it("dosažený stupeň nezmizí, když série spadne", () => {
    const states = byId(evaluateBadges({ ...facts, streak: 0 }, { streak: 2 }));
    expect(states.streak.level).toBe(2);
  });

  it("nové stupně se poznají proti uloženým a uloží se", () => {
    const stored = { streak: 1 };
    const states = evaluateBadges({ ...facts, streak: 31 }, stored);
    expect(newlyEarned(states, stored).map((s) => [s.id, s.level])).toContainEqual(["streak", 2]);
    expect(mergeLevels(states, stored).streak).toBe(2);
  });
});

describe("pomocníci", () => {
  it("nejdelší řada dní", () => {
    expect(longestRun(["2026-09-01", "2026-09-02", "2026-09-02", "2026-09-04", "2026-09-05", "2026-09-06"])).toBe(3);
    expect(longestRun([])).toBe(0);
    // přes konec měsíce
    expect(longestRun(["2026-08-31", "2026-09-01"])).toBe(2);
  });

  it("ligové odznaky z historie", () => {
    expect(
      leagueFacts(
        [
          { tier: 1, rank: 2, size: 14 },
          { tier: 2, rank: 1, size: 12 },
        ],
        5,
        9,
      ),
    ).toEqual({ promoted: true, reachedTopLeague: false, wonWeek: true });
    // vítězství v malé skupině se nepočítá
    expect(leagueFacts([{ tier: 1, rank: 1, size: 3 }], 5, 9).wonWeek).toBe(false);
  });
});
