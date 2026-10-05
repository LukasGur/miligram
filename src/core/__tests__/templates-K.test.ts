import { describe, expect, it } from "vitest";
import "../templates";
import { allTemplates, buildExercise, getTemplate } from "../templates";
import { dosingRule, liquidPresentationOf, type DosingRuleId } from "../products/dosing";
import { DIFFICULTIES, type Difficulty } from "../types";

const SEEDS = Array.from({ length: 40 }, (_, i) => `k${i}`);
const D = 2 as Difficulty;

describe("K1 — objem sirupu na podání", () => {
  it("na pevném zadání vyjde ručně ověřená hodnota", () => {
    // 20 kg, 30 mg/kg/den, 3× denně, suspenze 20 mg/ml
    // 600 mg/den → 200 mg na dávku → 10 ml
    const solution = getTemplate("K1").solve(
      { weightKg: 20, mgPerKgPerDay: 30, dosesPerDay: 3, concentration: 20 },
      D,
    );
    expect(solution.value).toBe(10);
  });

  it("dávka nikdy nepřekročí rozmezí z SPC", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { vars } = buildExercise("K1", seed, difficulty);
        const rule = dosingRule(String(vars.ruleId) as DosingRuleId);
        const range = rule.daily;
        expect(range, String(vars.ruleId)).toBeDefined();
        expect(Number(vars.mgPerKgPerDay)).toBeGreaterThanOrEqual(range!.min);
        expect(Number(vars.mgPerKgPerDay)).toBeLessThanOrEqual(range!.max);
      }
    }
  });

  it("koncentrace se bere z balení uvedeného u pravidla", () => {
    for (const seed of SEEDS) {
      const { vars } = buildExercise("K1", seed, D);
      const presentation = liquidPresentationOf(String(vars.ruleId) as DosingRuleId);
      expect(Number(vars.concentration)).toBeCloseTo(
        presentation.strengthMg / presentation.referenceMl,
        9,
      );
    }
  });
});

describe("K2 — strop denní dávky", () => {
  it("na pevném zadání vyjde ručně ověřená hodnota", () => {
    // 10 kg, max 40 mg/kg/den, 4× denně, 20 mg/ml → 400 mg/den → 100 mg → 5 ml
    const solution = getTemplate("K2").solve(
      { weightKg: 10, maxDailyPerKg: 40, dosesPerDay: 4, concentration: 20 },
      D,
    );
    expect(solution.value).toBe(5);
  });

  it("strop je vždy vyšší než dávka spočítaná z obvyklého rozmezí", () => {
    for (const seed of SEEDS) {
      const { vars } = buildExercise("K2", seed, D);
      const rule = dosingRule(String(vars.ruleId) as DosingRuleId);
      expect(rule.maxDaily, String(vars.ruleId)).toBeDefined();
      const usual = rule.daily ?? rule.single;
      if (usual) expect(rule.maxDaily!.min).toBeGreaterThanOrEqual(usual.max);
    }
  });
});

describe("K3 — vzorec ze SPC Augmentinu", () => {
  it("reprodukuje příklad uvedený přímo v SPC", () => {
    // SPC: dítě 14 kg, 25 mg/kg/den, suspenze 80 mg/ml → 350 / 160 = 2,1875 ml
    // Tabulka v SPC uvádí pro 14 kg hodnotu 2,2 ml.
    const solution = getTemplate("K3").solve(
      { weightKg: 14, mgPerKgPerDay: 25, concentration: 80, dosesPerDay: 2 },
      D,
    );
    expect(solution.value).toBeCloseTo(2.1875, 6);
    expect(Number(solution.value.toFixed(1))).toBe(2.2);
  });

  it("počítá jen s amoxicilinovou složkou, ne se součtem obou", () => {
    for (const seed of SEEDS) {
      const { vars } = buildExercise("K3", seed, D);
      expect(Number(vars.concentration)).toBe(80);
      expect(Number(vars.dosesPerDay)).toBe(2);
    }
  });
});

describe("K4 — nejmenší pacienti", () => {
  it("adrenalin 0,01 mg/kg u tříkilového novorozence je 0,03 mg", () => {
    const solution = getTemplate("K4").solve({ weightKg: 3, perKg: 0.01, unit: "mg/kg" }, D);
    expect(solution.value).toBeCloseTo(0.03, 9);
  });

  it("odpověď jde zapsat nejvýš na tři desetinná místa", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { solution, answer } = buildExercise("K4", seed, difficulty);
        expect(answer.decimals).toBeLessThanOrEqual(3);
        expect(Number(solution.value.toFixed(3)), `${difficulty}/${seed}`).toBeCloseTo(solution.value, 6);
      }
    }
  });

  it("pod tři kilogramy sahá jen pravidlo, jehož SPC mluví o novorozencích", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { vars } = buildExercise("K4", seed, difficulty);
        if (Number(vars.weightKg) < 3) expect(vars.ruleId).toBe("adrenalinResuscitace");
      }
    }
  });
});

describe("K5 — kontrola předepsaného objemu", () => {
  it("na pevném zadání vyjde ručně ověřená hodnota", () => {
    // 5 ml po 20 mg/ml třikrát denně u 15kg dítěte → 300 mg/den → 20 mg/kg/den
    const solution = getTemplate("K5").solve(
      { prescribedMl: 5, concentration: 20, dosesPerDay: 3, weightKg: 15 },
      D,
    );
    expect(solution.value).toBe(20);
  });

  it("rozmezí v zadání je denní rozmezí ze SPC, ne dávka na jedno podání", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { vars } = buildExercise("K5", seed, difficulty);
        const daily = dosingRule(vars.ruleId as DosingRuleId).daily;
        expect(daily, `${vars.ruleId}`).toBeDefined();
        expect([vars.rangeMin, vars.rangeMax]).toEqual([daily!.min, daily!.max]);
      }
    }
  });

  it("předepsaný objem je vždy hodnota, kterou jde natáhnout po půl mililitru", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const ml = Number(buildExercise("K5", seed, difficulty).vars.prescribedMl);
        expect(Math.round(ml * 2), `${difficulty}/${seed}`).toBeCloseTo(ml * 2, 9);
        expect(ml).toBeGreaterThanOrEqual(0.5);
      }
    }
  });
});

describe("K6 — jiná síla sirupu", () => {
  it("5 ml po 40 mg/ml odpovídá 10 ml po 20 mg/ml", () => {
    const solution = getTemplate("K6").solve(
      { prescribedMl: 5, fromConcentration: 40, toConcentration: 20 },
      D,
    );
    expect(solution.value).toBe(10);
  });

  it("obě síly patří téže látce a liší se", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { vars } = buildExercise("K6", seed, difficulty);
        expect(Number(vars.fromConcentration)).not.toBe(Number(vars.toConcentration));
        expect(String(vars.fromCode)).not.toBe(String(vars.toCode));
      }
    }
  });
});

describe("kategorie K je kompletní", () => {
  it("registrováno je všech šest šablon", () => {
    const ids = allTemplates().map((t) => t.id).filter((id) => id.startsWith("K"));
    expect(ids.sort()).toEqual(["K1", "K2", "K3", "K4", "K5", "K6"]);
  });
});
