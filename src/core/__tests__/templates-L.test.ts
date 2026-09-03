import { describe, expect, it } from "vitest";
import "../templates";
import { allTemplates, buildExercise, getTemplate, productionTemplates } from "../templates";
import { dosingRule } from "../products/dosing";
import { AUC_TARGETS, DOSE_REDUCTION_PERCENT } from "../products/oncology";
import { DIFFICULTIES, type Difficulty } from "../types";

const SEEDS = Array.from({ length: 40 }, (_, i) => `l${i}`);
const D = 2 as Difficulty;

describe("onkologické údaje ze SPC", () => {
  it("cílové hodnoty AUC odpovídají tabulce v SPC karboplatiny", () => {
    for (const target of AUC_TARGETS) {
      expect(target.auc).toBeGreaterThanOrEqual(4);
      expect(target.auc).toBeLessThanOrEqual(7);
    }
  });

  it("kumulativní limit doxorubicinu je dvojí a rizikový je nižší", () => {
    const rule = dosingRule("doxorubicin");
    expect(rule.cumulativeMaxMgPerM2).toBe(550);
    expect(rule.cumulativeRiskMgPerM2).toBe(400);
    expect(rule.quote).toContain("550 mg/m²");
  });

  it("rozsah redukce dávky je ten, o kterém mluví SPC", () => {
    expect(DOSE_REDUCTION_PERCENT).toEqual({ min: 20, max: 25 });
  });
});

describe("L1 — dávka podle Calverta", () => {
  it("na pevném zadání vyjde ručně ověřená hodnota", () => {
    // AUC 5 × (80 + 25) = 525 mg
    expect(getTemplate("L1").solve({ auc: 5, gfrMlPerMin: 80, regimen: "" }, D).value).toBe(525);
  });

  it("výsledek je v miligramech, ne v mg/m² — nezávisí na povrchu těla", () => {
    for (const seed of SEEDS) {
      const { vars } = buildExercise("L1", seed, D);
      expect(vars.heightCm).toBeUndefined();
      expect(vars.weightKg).toBeUndefined();
    }
  });
});

describe("L2 — od Calverta k objemu", () => {
  it("525 mg z koncentrátu 10 mg/ml je 52,5 ml", () => {
    const solution = getTemplate("L2").solve(
      { auc: 5, gfrMlPerMin: 80, concentration: 10, fromCreatinine: 0 },
      D,
    );
    expect(solution.value).toBe(52.5);
  });

  it("třetí úroveň začíná u kreatininu", () => {
    for (const seed of SEEDS) {
      expect(Number(buildExercise("L2", seed, 3).vars.fromCreatinine)).toBe(1);
      expect(Number(buildExercise("L2", seed, 1).vars.fromCreatinine)).toBe(0);
    }
  });
});

describe("L3 — redukce dávky", () => {
  it("snížení o 25 % z 800 mg je 600 mg", () => {
    // 180 cm a 80 kg dá BSA 2,00 m²; 400 mg/m² × 2 = 800 mg
    const solution = getTemplate("L3").solve(
      { heightCm: 180, weightKg: 80, fullDosePerM2: 400, reductionPercent: 25, ruleId: "karboplatina" },
      D,
    );
    expect(solution.value).toBeCloseTo(600, 0);
  });

  it("snížená dávka je vždy menší než plná a větší než tři čtvrtiny", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { vars } = buildExercise("L3", seed, difficulty);
        const percent = Number(vars.reductionPercent);
        expect(percent).toBeGreaterThanOrEqual(DOSE_REDUCTION_PERCENT.min);
        expect(percent).toBeLessThanOrEqual(DOSE_REDUCTION_PERCENT.max);
      }
    }
  });
});

describe("L4 — kumulativní dávka antracyklinu", () => {
  it("po 300 mg/m² a při 75 mg/m² na cyklus zbývají tři cykly", () => {
    const solution = getTemplate("L4").solve(
      { limitMgPerM2: 550, alreadyGiven: 300, dosePerCycle: 75, atRisk: 0 },
      D,
    );
    expect(solution.value).toBe(3);
  });

  it("neúplný cyklus se nezapočítá", () => {
    const solution = getTemplate("L4").solve(
      { limitMgPerM2: 550, alreadyGiven: 400, dosePerCycle: 60, atRisk: 0 },
      D,
    );
    expect(solution.value).toBe(2);
  });

  it("vždy zbývá aspoň jeden celý cyklus a limit je z SPC", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { vars, solution } = buildExercise("L4", seed, difficulty);
        expect(solution.value, `${difficulty}/${seed}`).toBeGreaterThanOrEqual(1);
        expect([400, 550]).toContain(Number(vars.limitMgPerM2));
        expect(Number(vars.alreadyGiven)).toBeLessThan(Number(vars.limitMgPerM2));
      }
    }
  });

  it("rizikový limit se objeví až na třetí úrovni", () => {
    for (const seed of SEEDS) {
      expect(Number(buildExercise("L4", seed, 1).vars.limitMgPerM2)).toBe(550);
      expect(Number(buildExercise("L4", seed, 2).vars.limitMgPerM2)).toBe(550);
    }
  });
});

describe("seznam šablon je hotový", () => {
  it("kategorie L má čtyři šablony", () => {
    const ids = allTemplates().map((t) => t.id).filter((id) => id.startsWith("L"));
    expect(ids.sort()).toEqual(["L1", "L2", "L3", "L4"]);
  });

  it("hotových je 72 šablon, z toho 71 v produkčním setu", () => {
    expect(allTemplates()).toHaveLength(72);
    expect(productionTemplates()).toHaveLength(71);
  });

  it("každá kategorie z briefu má aspoň jednu šablonu", () => {
    const categories = new Set(allTemplates().map((t) => t.category));
    expect([...categories].sort()).toEqual([
      "hmotnost", "infuze", "inzulin", "onkologie", "pediatrie", "povrch",
      "prevody", "redeni", "rekonstituce", "renalni", "vazoaktivni", "zaklad",
    ]);
  });
});
