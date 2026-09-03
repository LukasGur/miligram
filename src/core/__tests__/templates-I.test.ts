import { describe, expect, it } from "vitest";
import "../templates";
import { allTemplates, buildExercise, getTemplate, productionTemplates } from "../templates";
import { DIFFICULTIES, type Difficulty } from "../types";

const SEEDS = Array.from({ length: 40 }, (_, i) => `i${i}`);
const D = 2 as Difficulty;

describe("I1 — inzulin 100 IU/ml", () => {
  it("40 IU při 100 IU/ml je 0,4 ml", () => {
    expect(getTemplate("I1").solve({ doseIU: 40, perMl: 100 }, D).value).toBeCloseTo(0.4, 9);
  });

  it("losuje jen přípravky se 100 IU/ml", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        expect(Number(buildExercise("I1", seed, difficulty).vars.perMl)).toBe(100);
      }
    }
  });
});

describe("I2 — inzulin 40 IU/ml", () => {
  it("40 IU při 40 IU/ml je 1 ml, ne 0,4 ml", () => {
    expect(getTemplate("I2").solve({ doseIU: 40, perMl: 40 }, D).value).toBe(1);
  });

  it("řešení ukazuje i objem, který by vyšel při 100 IU/ml", () => {
    const { solution } = buildExercise("I2", "i7", D);
    expect(solution.steps.map((s) => s.textKey)).toContain("porovnaniKoncentraci");
  });

  it("losuje jen přípravky se 40 IU/ml", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        expect(Number(buildExercise("I2", seed, difficulty).vars.perMl)).toBe(40);
      }
    }
  });
});

describe("I3 — korekční faktor", () => {
  it("zůstává mimo produkční set, dokud nemá zdroj", () => {
    expect(getTemplate("I3").needsReview).toBe(true);
    expect(productionTemplates().map((t) => t.id)).not.toContain("I3");
  });

  it("při denní dávce 50 IU je korekční faktor 2 mmol/l na jednotku", () => {
    // (14 − 6) / (100 / 50) = 8 / 2 = 4 IU
    const solution = getTemplate("I3").solve(
      { totalDailyIU: 50, currentMmolPerL: 14, targetMmolPerL: 6 },
      D,
    );
    expect(solution.value).toBeCloseTo(4, 9);
  });
});

describe("I4 — na kolik dní vystačí vložka", () => {
  it("300 IU při 20 IU denně vystačí na 15 dní", () => {
    const solution = getTemplate("I4").solve(
      { contentIU: 300, dailyIU: 20, perMl: 100, cartridgeMl: 3 },
      D,
    );
    expect(solution.value).toBe(15);
  });

  it("zbytek, který na celý den nestačí, se nezapočítá", () => {
    const solution = getTemplate("I4").solve(
      { contentIU: 300, dailyIU: 22, perMl: 100, cartridgeMl: 3 },
      D,
    );
    expect(solution.value).toBe(13);
  });

  it("vložka vždy vystačí aspoň na tři dny", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { solution } = buildExercise("I4", seed, difficulty);
        expect(solution.value, `${difficulty}/${seed}`).toBeGreaterThanOrEqual(3);
        expect(Number.isInteger(solution.value)).toBe(true);
      }
    }
  });

  it("obsah vložky je součin objemu a koncentrace, ne údaj odjinud", () => {
    for (const seed of SEEDS) {
      const { vars } = buildExercise("I4", seed, D);
      expect(Number(vars.contentIU)).toBeCloseTo(Number(vars.cartridgeMl) * Number(vars.perMl), 6);
    }
  });
});

describe("kategorie I je kompletní", () => {
  it("registrovány jsou všechny čtyři šablony", () => {
    const ids = allTemplates().map((t) => t.id).filter((id) => id.startsWith("I"));
    expect(ids.sort()).toEqual(["I1", "I2", "I3", "I4"]);
  });
});
