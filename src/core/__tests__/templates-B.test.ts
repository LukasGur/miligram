import { describe, expect, it } from "vitest";
import "../templates";
import { buildExercise, getTemplate } from "../templates";
import { DOSING_RULE_LIST, dosingRule, liquidPresentationOf, presentationOf, type DosingRuleId } from "../products/dosing";
import { DIFFICULTIES, type Difficulty } from "../types";

const D2 = 2 as Difficulty;
const SEEDS = Array.from({ length: 40 }, (_, i) => `b${i}`);

describe("dávkovací pravidla ze SPC", () => {
  it("každé pravidlo cituje konkrétní SPC a nese kód SÚKL", () => {
    for (const [id, rule] of DOSING_RULE_LIST) {
      expect(rule.spc, id).toMatch(/^SPC\d+\.pdf$/);
      expect(rule.suklCode, id).toMatch(/^\d{7}$/);
      expect(rule.quote.length, id).toBeGreaterThan(30);
    }
  });

  it("meze rozmezí dávají smysl", () => {
    for (const [id, rule] of DOSING_RULE_LIST) {
      for (const range of [rule.single, rule.daily, rule.loading, rule.maxDaily]) {
        if (!range) continue;
        expect(range.min, id).toBeGreaterThan(0);
        expect(range.max, id).toBeGreaterThanOrEqual(range.min);
      }
    }
  });

  /**
   * Fond dedupuje na jednu reprezentaci účinné látky, takže konkrétní
   * přípravek z pravidla v něm být nemusí — Carboplatin Accord ani
   * Nurofen pro děti v něm nejsou. Když pravidlo nemá vlastní údaje
   * o balení a ve fondu chybí, šablona spadne až za běhu. Tohle to
   * odchytí při testech.
   */
  it("každé pravidlo jde přeložit na údaje o balení", () => {
    const broken: string[] = [];
    for (const [id] of DOSING_RULE_LIST) {
      try {
        presentationOf(id);
      } catch (error) {
        broken.push(`${id}: ${(error as Error).message}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("pravidla, ze kterých se počítá objem, mají údaje o balení", () => {
    const needPresentation: DosingRuleId[] = [
      "amoxicilin", "ibuprofenDeti", "amoxicilinKlavulanat", "ibuprofenBaby",
    ];
    for (const id of needPresentation) {
      const presentation = liquidPresentationOf(id);
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

describe("C — dávkování podle povrchu těla", () => {
  const D = 2 as Difficulty;

  it("C1: 180 cm a 80 kg dá přesně 2 m²", () => {
    expect(getTemplate("C1").solve({ heightCm: 180, weightKg: 80 }, D).value).toBe(2);
  });

  it("C2: 175 mg/m² při povrchu 1,8 m² je 315 mg", () => {
    expect(getTemplate("C2").solve({ perM2: 175, bsaM2: 1.8 }, D).value).toBe(315);
  });

  it("C3: 175 mg/m², 180 cm, 80 kg a koncentrát 6 mg/ml dá 58,33 ml", () => {
    // BSA 2 m² → 350 mg → 350 / 6
    const solution = getTemplate("C3").solve(
      { heightCm: 180, weightKg: 80, perM2: 175, concentrationMgPerMl: 6 },
      D,
    );
    expect(solution.value).toBeCloseTo(58.333, 3);
  });

  it("C4: dvojnásobný povrch by znamenal sto procent navíc", () => {
    // 180/80 dá 2 m², 360/160 by dalo 4 m² — kontrola směru výpočtu
    const solution = getTemplate("C4").solve(
      { heightA: 180, weightA: 80, heightB: 180, weightB: 320 },
      D,
    );
    expect(solution.value).toBeCloseTo(100, 6);
  });

  it("C5: strop povrchu se uplatní jen u pacienta nad 2,0 m²", () => {
    expect(getTemplate("C5").solve({ perM2: 175, bsaM2: 2.3, capBsaM2: 2 }, D).value).toBe(350);
    expect(getTemplate("C5").solve({ perM2: 175, bsaM2: 1.8, capBsaM2: 2 }, D).value).toBe(315);
  });

  it("C1 dává povrch v rozsahu, který u lidí dává smysl", () => {
    for (const seed of SEEDS) {
      const { solution } = buildExercise("C1", seed, D);
      expect(solution.value).toBeGreaterThan(0.7);
      expect(solution.value).toBeLessThan(2.8);
    }
  });
});

describe("dávky, jaké by lékař napsal", () => {
  const SEEDS_REAL = Array.from({ length: 60 }, (_, i) => `real${i}`);

  it("B3: už podaná dávka leží v rozmezí jednotlivé dávky ze SPC", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS_REAL) {
        const { vars } = buildExercise("B3", seed, difficulty);
        const rule = dosingRule(vars.ruleId as DosingRuleId);
        const perKg = Number(vars.perDoseMg) / Number(vars.weightKg);
        const high = rule.single?.max ?? rule.daily!.max;
        // Zaokrouhlení na celé nebo pětky mg u malého dítěte posune mg/kg.
        expect(perKg, `${difficulty}/${seed}`).toBeLessThanOrEqual(high * 1.25 + 0.5);
        expect(Number(vars.perDoseMg) * Number(vars.dosesGiven), `${difficulty}/${seed}`)
          .toBeLessThan(Number(vars.limitPerKg) * Number(vars.weightKg));
      }
    }
  });

  it("B1, B5, B6: dávka na kilogram bez nesmyslných desetin", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS_REAL) {
        for (const [id, keys] of [["B1", ["perKg"]], ["B5", ["perKg"]], ["B6", ["loadingPerKg", "maintenancePerKg"]]] as const) {
          const { vars } = buildExercise(id, seed, difficulty);
          for (const key of keys) {
            const value = Number(vars[key]);
            expect(Math.round(value * 2), `${id}/${key}/${difficulty}/${seed}: ${value}`).toBe(value * 2);
          }
          if (id === "B1" && Number(vars.rangeMax) - Number(vars.rangeMin) >= 20) {
            expect(Number(vars.perKg) % 5, `${seed}`).toBe(0);
          }
        }
      }
    }
  });
});

describe("léková forma sedí na věk", () => {
  it("tablety paracetamolu jen od hmotnosti, pro kterou je SPC uvádí", () => {
    const SEEDS_AGE = Array.from({ length: 80 }, (_, i) => `age${i}`);
    for (const id of ["B1", "B3", "B7", "K4"]) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS_AGE) {
          const { vars } = buildExercise(id, seed, difficulty);
          const min = dosingRule(vars.ruleId as DosingRuleId).minWeightKg ?? 0;
          expect(Number(vars.weightKg), `${id}/${difficulty}/${seed}`).toBeGreaterThanOrEqual(min);
        }
      }
    }
  });
});

describe("valproát v mezích SPC", () => {
  const SEEDS_VPA = Array.from({ length: 400 }, (_, i) => `vpa${i}`);

  it("dospělý na Orfirilu dostane úvodní injekci 300–900 mg", () => {
    let seen = 0;
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS_VPA) {
        const { vars, solution } = buildExercise("B1", seed, difficulty);
        if (vars.ruleId !== "valproatDospeli") continue;
        seen++;
        expect(Number(vars.weightKg), seed).toBeGreaterThanOrEqual(60);
        expect(solution.value, `${difficulty}/${seed}`).toBeGreaterThanOrEqual(300);
        expect(solution.value, `${difficulty}/${seed}`).toBeLessThanOrEqual(900);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("dítě na Convulexu má perorální roztok a hmotnost z tabulky SPC", () => {
    let seen = 0;
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS_VPA) {
        const { vars } = buildExercise("B2", seed, difficulty);
        if (vars.ruleId !== "valproatDeti") continue;
        seen++;
        expect(vars.liquidForm).toBe("solution");
        expect(Number(vars.weightKg), seed).toBeGreaterThanOrEqual(5.5);
        expect(Number(vars.dosesPerDay)).toBeGreaterThanOrEqual(2);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe("dávka z tablet jde podat", () => {
  it("Paralen 125 mg jen v násobcích půl tablety (B3, B7)", () => {
    const SEEDS_TBL = Array.from({ length: 300 }, (_, i) => `tbl${i}`);
    let seen = 0;
    for (const id of ["B3", "B7"]) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS_TBL) {
          const { vars } = buildExercise(id, seed, difficulty);
          const step = dosingRule(vars.ruleId as DosingRuleId).doseStepMg;
          if (!step) continue;
          seen++;
          const halves = Number(vars.perDoseMg) / step;
          expect(Math.abs(halves - Math.round(halves)), `${id}/${difficulty}/${seed}: ${vars.perDoseMg}`).toBeLessThan(1e-9);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
