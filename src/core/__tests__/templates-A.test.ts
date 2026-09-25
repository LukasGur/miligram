import { describe, expect, it } from "vitest";
import "../templates";
import { buildExercise, getTemplate } from "../templates";
import type { Difficulty } from "../types";

const D2 = 2 as Difficulty;
const SEEDS = Array.from({ length: 40 }, (_, i) => `a${i}`);

/** Pevné případy s ručně spočítaným výsledkem. Náhodné zadání je jinde. */
describe("A — základní dávkování", () => {
  it("A1: 1 g z tablet po 500 mg jsou 2 tablety", () => {
    expect(getTemplate("A1").solve({ doseMg: 1000, strengthMg: 500 }, D2).value).toBe(2);
  });

  it("A2: 200 mg ze sirupu 100 mg / 5 ml je 10 ml", () => {
    expect(getTemplate("A2").solve({ doseMg: 200, strengthMg: 100, referenceMl: 5 }, D2).value).toBe(10);
  });

  it("A4: 250 mg z ampulí po 80 mg jsou 4 ampule", () => {
    // 250 / 80 = 3,125 → nahoru na 4; otevřená ampule se nevrací
    expect(getTemplate("A4").solve({ doseMg: 250, ampouleMg: 80 }, D2).value).toBe(4);
  });

  it("A4: přesný násobek se nahoru nezaokrouhluje", () => {
    expect(getTemplate("A4").solve({ doseMg: 240, ampouleMg: 80 }, D2).value).toBe(3);
  });

  it("A5: 187,5 µg z tablet po 0,125 mg je 1,5 tablety", () => {
    expect(getTemplate("A5").solve({ doseUg: 187.5, strengthMg: 0.125 }, D2).value).toBe(1.5);
  });

  it("A6: z ampule 20 mg / 2 ml po odebrání 15 mg zbývá 0,5 ml", () => {
    const solution = getTemplate("A6").solve({ doseMg: 15, ampouleMg: 20, ampouleMl: 2 }, D2);
    expect(solution.value).toBeCloseTo(0.5, 10);
  });

  it("A7: 2 tablety třikrát denně po 10 dní z balení po 30 jsou 2 balení", () => {
    // 2 × 3 × 10 = 60 tablet; 60 / 30 = 2
    expect(getTemplate("A7").solve({ perDose: 2, timesPerDay: 3, days: 10, packCount: 30 }, D2).value).toBe(2);
  });

  it("A7: zbytek přes celé balení znamená balení navíc", () => {
    // 1 × 2 × 20 = 40 tablet; 40 / 30 = 1,33 → 2
    expect(getTemplate("A7").solve({ perDose: 1, timesPerDay: 2, days: 20, packCount: 30 }, D2).value).toBe(2);
  });

  it("A8: 4 ml roztoku 25 mg/ml je 100 mg", () => {
    const solution = getTemplate("A8").solve(
      { concentrationMgPerMl: 25, givenMl: 4, strengthMg: 25, referenceMl: 1 },
      D2,
    );
    expect(solution.value).toBe(100);
  });

  it("A8: na třetí úrovni je výsledek v gramech", () => {
    const solution = getTemplate("A8").solve(
      { concentrationMgPerMl: 25, givenMl: 8, strengthMg: 25, referenceMl: 1 },
      3 as Difficulty,
    );
    expect(solution.value).toBe(0.2);
  });

  it("A4 a A7 vracejí celá čísla pro každé vylosované zadání", () => {
    for (const id of ["A4", "A7"]) {
      for (const seed of SEEDS) {
        const { solution } = buildExercise(id, seed, D2);
        expect(Number.isInteger(solution.value)).toBe(true);
        expect(solution.value).toBeGreaterThan(0);
      }
    }
  });

  it("A6 nikdy nevrátí víc, než kolik bylo v ampuli", () => {
    for (const seed of SEEDS) {
      const { vars, solution } = buildExercise("A6", seed, D2);
      expect(solution.value).toBeLessThan(Number(vars.ampouleMl));
      expect(solution.value).toBeGreaterThan(0);
    }
  });

  it("A5 zadává dávku vždy v mikrogramech, tisíckrát vyšší než v mg", () => {
    for (const seed of SEEDS) {
      const { vars } = buildExercise("A5", seed, D2);
      expect(Number(vars.doseUg)).toBeCloseTo(Number(vars.doseMg) * 1000, 6);
    }
  });
});

/**
 * „Tablety po 550 mg, ordinace 550 mg“ nebo „10 mg v 1 ml, podán 1 ml“
 * mají odpověď přímo v zadání. Obecný test na prozrazený výsledek hlásí
 * až soustavnou shodu, tady nesmí projít ani jedno semínko.
 */
describe("A — žádný příklad bez počítání", () => {
  const ALL = Array.from({ length: 200 }, (_, i) => `t${i}`);

  it.each([1, 2, 3] as Difficulty[])("A1 na obtížnosti %i není jedna celá tableta", (difficulty) => {
    for (const seed of ALL) {
      expect(buildExercise("A1", seed, difficulty).solution.value).not.toBe(1);
    }
  });

  it.each([1, 2, 3] as Difficulty[])("A8 na obtížnosti %i nepodává přesně referenční objem", (difficulty) => {
    for (const seed of ALL) {
      const { vars } = buildExercise("A8", seed, difficulty);
      expect(Number(vars.givenMl)).not.toBe(Number(vars.referenceMl));
    }
  });
});
