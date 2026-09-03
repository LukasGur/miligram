import { describe, expect, it } from "vitest";
import "../templates";
import { allTemplates, buildExercise, getTemplate } from "../templates";
import { mixedConcentration, percentToRatio, ratioToPercent } from "../formulas";
import { ELECTROLYTE_LIST } from "../products/electrolytes";
import type { Difficulty } from "../types";

const D = 2 as Difficulty;
const SEEDS = Array.from({ length: 40 }, (_, i) => `d${i}`);

describe("vzorce pro míchání a poměry", () => {
  it("smíchání dvou objemů je vážený průměr, ne prostý", () => {
    // 100 ml po 50 mg/ml a 400 ml po 100 mg/ml → 45 000 mg / 500 ml
    expect(mixedConcentration(
      [{ concentration: 50, volumeMl: 100 }, { concentration: 100, volumeMl: 400 }],
      500,
    )).toBe(90);
  });

  it("při stejných objemech vyjde prostý průměr", () => {
    expect(mixedConcentration(
      [{ concentration: 50, volumeMl: 100 }, { concentration: 100, volumeMl: 100 }],
      200,
    )).toBe(75);
  });

  it("jedna složka je totéž co naředění", () => {
    expect(mixedConcentration([{ concentration: 400, volumeMl: 50 }], 200)).toBe(100);
  });

  it("procenta a poměr jsou dva zápisy téhož", () => {
    expect(percentToRatio(1)).toBe(100);
    expect(percentToRatio(0.1)).toBe(1000);
    expect(ratioToPercent(1000)).toBe(0.1);
    expect(ratioToPercent(100000)).toBeCloseTo(0.001, 10);
  });

  it("odmítne prázdný roztok a záporné složky", () => {
    expect(() => mixedConcentration([], 100)).toThrow(/aspoň jednu složku/);
    expect(() => mixedConcentration([{ concentration: -1, volumeMl: 10 }], 100)).toThrow(/záporná/);
  });
});

describe("elektrolyty", () => {
  it("obsah iontu je opsaný z bodu 2 SPC a odpovídá hmotnostní koncentraci", () => {
    for (const [id, item] of ELECTROLYTE_LIST) {
      expect(item.spc, id).toMatch(/^SPC\d+\.pdf$/);
      expect(item.quote.length, id).toBeGreaterThan(30);
      // 7,45% roztok je 74,5 mg/ml — procenta a mg/ml musí sedět na sebe
      expect(item.mgPerMl, id).toBeCloseTo(item.percent * 10, 6);
      expect(item.mmolPerMl, id).toBeGreaterThan(0);
    }
  });
});

describe("D — ředění a koncentrace", () => {
  it("D1: z glukózy 40 % připraví 500 ml roztoku 10 % ze 125 ml", () => {
    const solution = getTemplate("D1").solve(
      { stockConcentration: 400, targetConcentration: 100, targetVolumeMl: 500 },
      D,
    );
    expect(solution.value).toBe(125);
  });

  it("D2: 250 ml roztoku 0,9 % obsahuje 2250 mg", () => {
    expect(getTemplate("D2").solve({ percent: 0.9, volumeMl: 250 }, D).value).toBe(2250);
  });

  it("D3: 0,01 mg/kg u 70 kg z roztoku 1:1000 je 0,7 ml", () => {
    const solution = getTemplate("D3").solve(
      { ratio: 1000, perKg: 0.01, weightKg: 70, maxSingleMg: 1 },
      D,
    );
    expect(solution.value).toBeCloseTo(0.7, 10);
  });

  it("D3: strop 1 mg z SPC se u těžkého pacienta uplatní", () => {
    const solution = getTemplate("D3").solve(
      { ratio: 1000, perKg: 0.03, weightKg: 90, maxSingleMg: 1 },
      D,
    );
    expect(solution.value).toBe(1);
  });

  it("D4: 50 ml koncentrátu 400 mg/ml ve 200 ml dá 100 mg/ml", () => {
    const solution = getTemplate("D4").solve(
      { stockConcentration: 400, stockVolumeMl: 50, totalVolumeMl: 200 },
      D,
    );
    expect(solution.value).toBe(100);
  });

  it("D5: 20 mmol draslíku z roztoku 1 mmol/ml je 20 ml", () => {
    expect(getTemplate("D5").solve({ mmol: 20, mmolPerMl: 1 }, D).value).toBe(20);
  });

  it("D6: na 500 ml roztoku 10 % z koncentrátu 40 % se přidá 375 ml", () => {
    // koncentrátu je potřeba 125 ml, zbytek doplní rozpouštědlo
    const solution = getTemplate("D6").solve(
      { stockConcentration: 400, targetConcentration: 100, targetVolumeMl: 500 },
      D,
    );
    expect(solution.value).toBe(375);
  });

  it("D7: 400 ml po 50 mg/ml a 100 ml po 100 mg/ml dá 60 mg/ml", () => {
    const solution = getTemplate("D7").solve(
      { concentrationA: 50, volumeA: 400, concentrationB: 100, volumeB: 100 },
      D,
    );
    expect(solution.value).toBe(60);
  });

  it("D8: 0,1 % je 1:1000 a naopak", () => {
    expect(getTemplate("D8").solve({ direction: "percentToRatio", percent: 0.1, ratio: 0 }, D).value).toBe(1000);
    expect(getTemplate("D8").solve({ direction: "ratioToPercent", percent: 0, ratio: 1000 }, D).value).toBe(0.1);
  });

  it("D1 nikdy nechce víc koncentrátu, než kolik má vzniknout roztoku", () => {
    for (const seed of SEEDS) {
      const { vars, solution } = buildExercise("D1", seed, D);
      expect(solution.value).toBeLessThan(Number(vars.targetVolumeMl));
    }
  });

  it("D6 nikdy nevrátí záporný objem rozpouštědla", () => {
    for (const seed of SEEDS) {
      expect(buildExercise("D6", seed, D).solution.value).toBeGreaterThan(0);
    }
  });

  it("D7 dá koncentraci mezi oběma složkami", () => {
    for (const seed of SEEDS) {
      const { vars, solution } = buildExercise("D7", seed, D);
      const low = Math.min(Number(vars.concentrationA), Number(vars.concentrationB));
      const high = Math.max(Number(vars.concentrationA), Number(vars.concentrationB));
      expect(solution.value).toBeGreaterThanOrEqual(low - 1e-9);
      expect(solution.value).toBeLessThanOrEqual(high + 1e-9);
    }
  });
});

describe("stav banky šablon", () => {
  it("hotových je tolik, kolik jich je zaregistrovaných", () => {
    const ids = allTemplates().map((t) => t.id).sort();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(32);
  });
});
