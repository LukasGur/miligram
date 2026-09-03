import { describe, expect, it } from "vitest";
import { scoreLesson, XP_FLAWLESS_BONUS, XP_PER_CORRECT } from "../scoring";

describe("skóre lekce", () => {
  it("dá deset XP za každý správný příklad", () => {
    expect(scoreLesson([true, false, true]).xp).toBe(2 * XP_PER_CORRECT);
  });

  it("přidá bonus za lekci bez chyby", () => {
    const result = scoreLesson(Array(7).fill(true));
    expect(result.flawless).toBe(true);
    expect(result.xp).toBe(7 * XP_PER_CORRECT + XP_FLAWLESS_BONUS);
  });

  it("jediná chyba bonus zruší", () => {
    const answers = Array(7).fill(true);
    answers[3] = false;
    expect(scoreLesson(answers).flawless).toBe(false);
    expect(scoreLesson(answers).xp).toBe(6 * XP_PER_CORRECT);
  });

  it("prázdná lekce není bezchybná", () => {
    expect(scoreLesson([])).toEqual({ count: 0, correct: 0, flawless: false, xp: 0 });
  });
});
