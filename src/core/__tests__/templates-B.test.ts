import { describe, expect, it } from "vitest";
import "../templates";
import { buildExercise, getTemplate } from "../templates";
import { DOSING_RULES, dosingRule, presentationOf, type DosingRuleId } from "../products/dosing";
import type { Difficulty } from "../types";

const D2 = 2 as Difficulty;
const SEEDS = Array.from({ length: 40 }, (_, i) => `b${i}`);

describe("dávkovací pravidla ze SPC", () => {
  it("každé pravidlo cituje konkrétní SPC a nese kód SÚKL", () => {
    for (const [id, rule] of Object.entries(DOSING_RULES)) {
      expect(rule.spc, id).toMatch(/^SPC\d+\.pdf$/);
      expect(rule.suklCode, id).toMatch(/^\d{7}$/);
      expect(rule.quote.length, id).toBeGreaterThan(30);
    }
  });

  it("meze rozmezí dávají smysl", () => {
    for (const [id, rule] of Object.entries(DOSING_RULES)) {
      for (const range of [rule.single, rule.daily, rule.loading, rule.maxDaily]) {
        if (!range) continue;
        expect(range.min, id).toBeGreaterThan(0);
        expect(range.max, id).toBeGreaterThanOrEqual(range.min);
      }
    }
  });

  it("pravidla, ze kterých se počítá objem, mají údaje o balení", () => {
    const needPresentation: DosingRuleId[] = [
      "amoxicilin", "ibuprofenDeti", "amoxicilinKlavulanat", "ibuprofenBaby",
    ];
    for (const id of needPresentation) {
      const presentation = presentationOf(id);
      expect(presentation.strengthMg, id).toBeGreaterThan(0);
      expect(presentation.referenceMl, id).toBeGreaterThan(0);
      expect(presentation.packVolumeMl, id).toBeGreaterThan(0);
    }
  });
});

describe("B — dávkování podle hmotnosti", () => {
  it("B1: 15 mg/kg u dítěte 18 kg je 270 mg", () => {
    expect(getTemplate("B1").solve({ perKg: 15, weightKg: 18 }, D2).value).toBe(270);
  });

  it("B2: 90 mg/kg/den ve třech dávkách u 20 kg ze sirupu 250 mg/5 ml je 12 ml", () => {
    // 90 × 20 = 1800 mg/den; / 3 = 600 mg; (600 / 250) × 5 = 12 ml
    const solution = getTemplate("B2").solve(
      { perKgPerDay: 90, weightKg: 20, dosesPerDay: 3, strengthMg: 250, referenceMl: 5 },
      D2,
    );
    expect(solution.value).toBe(12);
  });

  it("B3: při stropu 40 mg/kg/den a 15 kg zbývá po dvou dávkách po 150 mg 300 mg", () => {
    // 40 × 15 = 600 mg; podáno 2 × 150 = 300 mg; zbývá 300 mg
    const solution = getTemplate("B3").solve(
      { limitPerKg: 40, weightKg: 15, dosesGiven: 2, perDoseMg: 150 },
      D2,
    );
    expect(solution.value).toBe(300);
  });

  it("B4: 1 mg/kg u 60 kg ze stříkačky 60 mg / 0,6 ml je 0,6 ml", () => {
    const solution = getTemplate("B4").solve(
      { perKg: 1, weightKg: 60, strengthMg: 60, syringeMl: 0.6 },
      D2,
    );
    expect(solution.value).toBeCloseTo(0.6, 10);
  });

  it("B5: strop 2000 mg se u 120 kg při 20 mg/kg uplatní", () => {
    // 20 × 120 = 2400 mg → seříznuto na 2000 mg
    const solution = getTemplate("B5").solve(
      { perKg: 20, weightKg: 120, maxSingleMg: 2000 },
      D2,
    );
    expect(solution.value).toBe(2000);
  });

  it("B5: pod stropem se dávka nemění", () => {
    expect(getTemplate("B5").solve({ perKg: 15, weightKg: 80, maxSingleMg: 2000 }, D2).value).toBe(1200);
  });

  it("B6: rozdíl mezi 30 a 15 mg/kg u 70 kg je 1050 mg", () => {
    const solution = getTemplate("B6").solve(
      { loadingPerKg: 30, maintenancePerKg: 15, weightKg: 70 },
      D2,
    );
    expect(solution.value).toBe(1050);
  });

  it("B7: 200 mg čtyřikrát denně u 20 kg je 40 mg/kg/den", () => {
    const solution = getTemplate("B7").solve(
      { perDoseMg: 200, timesPerDay: 4, weightKg: 20 },
      D2,
    );
    expect(solution.value).toBe(40);
  });

  it("B8: lahvička 60 ml při 12 ml denně vystačí na 5 dní", () => {
    // 90 × 10 = 900 mg/den; /3 = 300 mg; (300/250)×5 = 6 ml; ×3 = 18 ml/den... 60/18 = 3
    const solution = getTemplate("B8").solve(
      { weightKg: 10, perKgPerDay: 90, dosesPerDay: 3, strengthMg: 250, referenceMl: 5, bottleMl: 60 },
      D2,
    );
    expect(solution.value).toBe(3);
  });

  it("B8 nikdy nevrátí méně než dva dny", () => {
    for (const difficulty of [1, 2, 3] as Difficulty[]) {
      for (const seed of SEEDS) {
        expect(buildExercise("B8", seed, difficulty).solution.value).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("B3 nikdy nenabídne zápornou zbývající dávku", () => {
    for (const seed of SEEDS) {
      expect(buildExercise("B3", seed, D2).solution.value).toBeGreaterThan(0);
    }
  });

  it("B5 nikdy nepřekročí strop z SPC", () => {
    for (const seed of SEEDS) {
      const { vars, solution } = buildExercise("B5", seed, D2);
      expect(solution.value).toBeLessThanOrEqual(Number(vars.maxSingleMg));
    }
  });

  it("B4 vybere stříkačku, do které se dávka vejde", () => {
    for (const seed of SEEDS) {
      const { vars, solution } = buildExercise("B4", seed, D2);
      expect(solution.value).toBeLessThanOrEqual(Number(vars.syringeMl) + 1e-9);
    }
  });

  it("B1 losuje dávku uvnitř rozmezí z SPC", () => {
    for (const seed of SEEDS) {
      const { vars } = buildExercise("B1", seed, D2);
      const rule = dosingRule(String(vars.ruleId) as DosingRuleId);
      expect(Number(vars.perKg)).toBeGreaterThanOrEqual(rule.single!.min);
      expect(Number(vars.perKg)).toBeLessThanOrEqual(rule.single!.max);
    }
  });
});
