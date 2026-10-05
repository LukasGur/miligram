import { describe, expect, it } from "vitest";
import "../templates";
import { buildExercise, getTemplate } from "../templates";
import { RECONSTITUTION_LIST } from "../products/reconstitution";
import { POWDER_VOLUMES } from "../products/powderVolumes";
import { DIFFICULTIES, type Difficulty } from "../types";

const D = 2 as Difficulty;
const SEEDS = Array.from({ length: 40 }, (_, i) => `e${i}`);

describe("pravidla rekonstituce", () => {
  it("koncentrace po rekonstituci sedí na obsah lahvičky a objem rozpouštědla", () => {
    for (const [id, rule] of RECONSTITUTION_LIST) {
      expect(rule.reconstitutedMgPerMl, id).toBeCloseTo(rule.vialMg / rule.diluentMl, 6);
      expect(rule.spc, id).toMatch(/^SPC\d+\.pdf$/);
      expect(rule.quote.length, id).toBeGreaterThan(40);
    }
  });

  it("nejmenší objem infuze odpovídá stropu koncentrace", () => {
    for (const [id, rule] of RECONSTITUTION_LIST) {
      if (rule.maxInfusionMgPerMl === undefined || rule.minInfusionMl === undefined) continue;
      // 1000 mg při stropu 5 mg/ml potřebuje aspoň 200 ml
      expect(rule.minInfusionMl, id).toBeGreaterThanOrEqual(rule.vialMg / rule.maxInfusionMgPerMl - 1e-9);
    }
  });
});

describe("E — rekonstituce", () => {
  it("E2: 1000 mg při stropu 5 mg/ml vyžaduje aspoň 200 ml", () => {
    expect(getTemplate("E2").solve({ doseMg: 1000, maxInfusionMgPerMl: 5 }, D).value).toBe(200);
  });

  it("E3: 1000 mg na koncentraci 20 mg/ml je 50 ml", () => {
    expect(getTemplate("E3").solve({ doseMg: 1000, targetMgPerMl: 20 }, D).value).toBe(50);
  });

  it("E4: objem prášku snižuje výslednou koncentraci", () => {
    // 1000 mg v 9,3 ml rozpouštědla + 0,7 ml prášku = 100 mg/ml
    const withDisplacement = getTemplate("E4").solve(
      { vialMg: 1000, diluentMl: 9.3, displacementMl: 0.7 },
      D,
    ).value;
    const withoutDisplacement = 1000 / 9.3;
    expect(withDisplacement).toBe(100);
    expect(withDisplacement).toBeLessThan(withoutDisplacement);
  });

  it("E4: 1000 mg s 3 ml rozpouštědla a koncentrací 250 mg/ml — prášek zabírá 1 ml", () => {
    expect(
      getTemplate("E4").solve({ form: "volume", vialMg: 1000, diluentMl: 3, approxMgPerMl: 250 }, D).value,
    ).toBeCloseTo(1, 9);
  });

  it("E4: čísla jsou ze SPC a prášek vždy něco zabere", () => {
    for (const difficulty of [1, 2, 3] as const) {
      for (let i = 0; i < 80; i += 1) {
        const { vars, solution, source } = buildExercise("E4", `e4-${i}`, difficulty);
        const item = POWDER_VOLUMES.find(
          (one) => one.suklCode === vars.code && one.diluentMl === vars.diluentMl,
        );
        expect(item, `${vars.productName} ${vars.diluentMl} ml`).toBeDefined();
        expect([source].flat().map((s) => s.citation).join(" ")).toContain(item!.quote);
        if (vars.form === "volume") expect(solution.value).toBeGreaterThan(0);
        else if (vars.form === "draw") {
          // Natahuje se jen část lahvičky, a méně, než kolik roztoku vznikne.
          expect(Number(vars.doseMg)).toBeLessThan(Number(vars.vialMg));
          expect(solution.value).toBeLessThan(Number(vars.vialMg) / Number(vars.approxMgPerMl));
        } else expect(Number(vars.displacementMl)).toBeGreaterThan(0);
      }
    }
  });

  it("E5: 2500 mg z lahviček po 1000 mg jsou tři lahvičky", () => {
    expect(getTemplate("E5").solve({ doseMg: 2500, vialMg: 1000 }, D).value).toBe(3);
  });

  it("E3 nikdy nenavrhne objem mimo rozsah z SPC", () => {
    for (const seed of SEEDS) {
      const { vars } = buildExercise("E3", seed, D);
      expect(Number(vars.targetMgPerMl)).toBeGreaterThanOrEqual(Number(vars.rangeMin));
      expect(Number(vars.targetMgPerMl)).toBeLessThanOrEqual(Number(vars.rangeMax));
    }
  });
});

describe("F — rychlost infuze", () => {
  it("F1: 1000 ml za 8 hodin je 125 ml/h", () => {
    expect(getTemplate("F1").solve({ bagMl: 1000, hours: 8 }, D).value).toBe(125);
  });

  it("F3: mikrokapky jen do 100 ml/h", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of Array.from({ length: 60 }, (_, i) => `f3-${i}`)) {
        const { vars } = buildExercise("F3", seed, difficulty);
        expect(Number(vars.bagMl) / Number(vars.hours), `${difficulty}/${seed}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("F3: u mikrokapkového setu se kapky rovnají ml/h", () => {
    const solution = getTemplate("F3").solve({ bagMl: 500, hours: 4 }, D);
    expect(solution.value).toBe(125);
  });

  it("F4: 500 ml rychlostí 125 ml/h dokape za 240 minut", () => {
    expect(getTemplate("F4").solve({ bagMl: 500, rateMlPerHour: 125 }, D).value).toBe(240);
  });

  it("F5: 20 kapek za minutu při faktoru 20 je 60 ml/h", () => {
    expect(getTemplate("F5").solve({ dropFactor: 20, dropsPerMin: 20 }, D).value).toBe(60);
  });

  it("F5 a F2 jsou navzájem obrácené", () => {
    // 1000 ml za 480 min při 20 gtt/ml dá 41,67 kapek; zpět to musí dát 125 ml/h
    const drops = getTemplate("F2").solve({ bagMl: 1000, dropFactor: 20, hours: 8 }, D).value;
    const rate = getTemplate("F5").solve({ dropFactor: 20, dropsPerMin: drops }, D).value;
    expect(rate).toBeCloseTo(125, 6);
  });

  it("F6: z 500 ml po 60 minutách při 125 ml/h zbývá 180 minut", () => {
    // podáno 125 ml, zbývá 375 ml → 375 / 125 × 60
    const solution = getTemplate("F6").solve(
      { bagMl: 500, rateMlPerHour: 125, elapsedMinutes: 60 },
      D,
    );
    expect(solution.value).toBe(180);
  });

  it("F6 nikdy nevrátí záporný čas", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        expect(buildExercise("F6", seed, difficulty).solution.value).toBeGreaterThan(0);
      }
    }
  });
});

describe("G — kontinuální infuze", () => {
  it("G1: 6 µg/min z roztoku 0,08 mg/ml je 4,5 ml/h", () => {
    expect(getTemplate("G1").solve({ totalMg: 4, syringeMl: 50, dosePerMin: 6 }, D).value).toBe(4.5);
  });

  it("G3: 4,8 ml/h z roztoku 5 mg/ml u 80 kg je 5 µg/kg/min", () => {
    const solution = getTemplate("G3").solve(
      { totalMg: 250, syringeMl: 50, weightKg: 80, rateMlPerHour: 4.8 },
      D,
    );
    expect(solution.value).toBeCloseTo(5, 10);
  });

  it("G2 a G3 jsou navzájem obrácené", () => {
    const rate = getTemplate("G2").solve(
      { totalMg: 250, syringeMl: 50, weightKg: 80, dosePerKgMin: 5 },
      D,
    ).value;
    const dose = getTemplate("G3").solve(
      { totalMg: 250, syringeMl: 50, weightKg: 80, rateMlPerHour: rate },
      D,
    ).value;
    expect(dose).toBeCloseTo(5, 9);
  });

  it("G4: na 5 mg/ml v 50 ml z ampulí po 250 mg je potřeba jedna", () => {
    expect(getTemplate("G4").solve({ targetConcentration: 5, syringeMl: 50, ampouleMg: 250 }, D).value).toBe(1);
  });

  it("G5: zvýšení z 5 na 10 µg/kg/min zdvojnásobí rychlost", () => {
    const solution = getTemplate("G5").solve(
      { totalMg: 250, syringeMl: 50, weightKg: 80, fromDose: 5, toDose: 10 },
      D,
    );
    expect(solution.value).toBeCloseTo(4.8, 9);
  });

  it("G6: dvě ampule po 5 ml do stříkačky 50 ml znamenají 40 ml ředidla", () => {
    expect(getTemplate("G6").solve({ ampouleMl: 5, ampoules: 2, syringeMl: 50 }, D).value).toBe(40);
  });

  it("G7: 5 µg/kg/min u 80 kg je 400 µg/min a zpět", () => {
    expect(getTemplate("G7").solve(
      { direction: "perKgToTotal", weightKg: 80, dosePerKgMin: 5, dosePerMin: 0 }, D,
    ).value).toBe(400);
    expect(getTemplate("G7").solve(
      { direction: "totalToPerKg", weightKg: 80, dosePerKgMin: 0, dosePerMin: 400 }, D,
    ).value).toBe(5);
  });

  it("G6 nikdy nevrátí záporný objem ředidla", () => {
    for (const seed of SEEDS) {
      expect(buildExercise("G6", seed, D).solution.value).toBeGreaterThan(0);
    }
  });

  it("rychlosti v perfuzorových šablonách zůstávají v rozsahu pumpy", () => {
    for (const id of ["G1", "G2", "G5"]) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          const { solution } = buildExercise(id, seed, difficulty);
          expect(Math.abs(solution.value), `${id}/${difficulty}/${seed}`).toBeLessThan(1000);
        }
      }
    }
  });
});

describe("nosné infuze v rozumných mezích", () => {
  const SEEDS_F = Array.from({ length: 80 }, (_, i) => `f-${i}`);
  it("F1, F2: rychlost 10–500 ml/h, kapky 5–120 za minutu", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS_F) {
        const f1 = buildExercise("F1", seed, difficulty);
        const rate1 = f1.solution.value;
        expect(rate1, `F1 ${difficulty}/${seed}`).toBeGreaterThanOrEqual(10);
        expect(rate1, `F1 ${difficulty}/${seed}`).toBeLessThanOrEqual(500);
        const f2 = buildExercise("F2", seed, difficulty);
        expect(f2.solution.value, `F2 ${difficulty}/${seed}`).toBeGreaterThanOrEqual(5);
        expect(f2.solution.value, `F2 ${difficulty}/${seed}`).toBeLessThanOrEqual(120);
      }
    }
  });

  it("F4, F6: vak dokape za půl hodiny až den", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS_F) {
        for (const id of ["F4", "F6"]) {
          const { vars } = buildExercise(id, seed, difficulty);
          const hours = Number(vars.bagMl) / Number(vars.rateMlPerHour);
          expect(hours, `${id} ${difficulty}/${seed}`).toBeGreaterThanOrEqual(0.5);
          expect(hours, `${id} ${difficulty}/${seed}`).toBeLessThanOrEqual(24);
        }
      }
    }
  });
});
