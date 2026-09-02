import { describe, expect, it } from "vitest";
import { evaluateAnswer } from "../answer";
import * as tolerances from "../tolerances";
import { dropsPerMinute, infusionRateMlPerHour } from "../formulas";
import {
  DROP_FACTORS,
  SYRINGE_SIZES_ML,
  syringeFor,
  syringeToleranceMl,
  pumpStepMlPerHour,
} from "../devices";

describe("kapkové faktory proti tabulce výrobce", () => {
  /**
   * Referenční hodnoty jsou z dokumentu B. Braun IV109 3/20 (Gravity Flow
   * Rate Drip Chart). Tabulka udává kapky za minutu pro danou rychlost
   * a kapkový faktor, takže se o ni dá opřít celý výpočet.
   */
  const chart: Array<[mlPerHour: number, dropFactor: number, dropsPerMin: number]> = [
    [10, 10, 2], [10, 20, 3], [10, 60, 10],
    [75, 15, 19], [75, 20, 25],
    [100, 10, 17], [100, 15, 25], [100, 20, 33],
    [125, 15, 31], [125, 20, 42],
    [150, 20, 50],
    [250, 10, 42], [250, 15, 62], [250, 20, 83],
    [1000, 10, 167], [1000, 15, 250], [1000, 20, 333],
  ];

  /**
   * Tabulka je v ml/h, vzorec pracuje s objemem a časem — hodinu tedy
   * vyjádříme jako 60 minut daného objemu.
   *
   * Porovnává se odchylka do půl kapky, ne shoda po zaokrouhlení: výrobce
   * u přesné poloviny zaokrouhluje dolů (250 ml/h při 15 gtt/ml je 62,5
   * a v tabulce stojí 62), zatímco 18,75 uvádí jako 19. To je jeho volba
   * pro remízu, ne norma, a aplikace ji po uživateli vymáhat nebude.
   */
  it.each(chart)("%i ml/h při %i gtt/ml dá %i kapek/min", (mlPerHour, factor, expected) => {
    expect(Math.abs(dropsPerMinute(mlPerHour, factor, 60) - expected)).toBeLessThanOrEqual(0.5);
  });

  it("mikrokapkový set 60 gtt/ml dává tolik kapek, kolik je ml/h", () => {
    for (const rate of [10, 25, 50, 125, 500]) {
      expect(dropsPerMinute(rate, 60, 60)).toBe(rate);
    }
  });

  it("výrobce uvádí čtyři kapkové faktory", () => {
    expect([...DROP_FACTORS]).toEqual([10, 15, 20, 60]);
  });

  it("rychlost a kapky drží spolu i u nekulatých hodnot", () => {
    const rate = infusionRateMlPerHour(1000, 480);
    expect(rate).toBe(125);
    expect(dropsPerMinute(rate, 20, 60)).toBeCloseTo(41.6667, 4);
  });
});

describe("tolerance odměření stříkačkou podle ISO 7886-1", () => {
  it("vybere nejmenší stříkačku, do které se objem vejde", () => {
    expect(syringeFor(0.4)).toBe(1);
    expect(syringeFor(1)).toBe(1);
    expect(syringeFor(1.5)).toBe(2);
    expect(syringeFor(6)).toBe(10);
    expect(syringeFor(50)).toBe(50);
    expect(syringeFor(60)).toBeNull();
  });

  it("nad polovinou jmenovitého objemu platí ±5 % odměřeného", () => {
    // 1,5 ml ve dvoumililitrové stříkačce: 5 % z 1,5
    expect(syringeToleranceMl(1.5)).toBeCloseTo(0.075, 10);
    // 2 ml ve dvoumililitrové: 5 % z 2
    expect(syringeToleranceMl(2)).toBeCloseTo(0.1, 10);
  });

  it("pod polovinou se přičítá podíl jmenovitého objemu", () => {
    // 0,3 ml v jednomililitrové: 1,5 % z 1 + 2 % z 0,3
    expect(syringeToleranceMl(0.3)).toBeCloseTo(0.021, 10);
    // 2 ml v pětimililitrové: 1,5 % z 5 + 2 % z 2
    expect(syringeToleranceMl(2.0001)).toBeCloseTo(0.115, 3);
  });

  it("tolerance roste s objemem a nikdy není záporná", () => {
    for (const size of SYRINGE_SIZES_ML) {
      expect(syringeToleranceMl(size)).toBeGreaterThan(0);
    }
    expect(() => syringeToleranceMl(80)).toThrow(/nevejde/);
  });
});

describe("krok nastavení pumpy", () => {
  it("pod 100 ml/h po setinách, výš po desetinách", () => {
    expect(pumpStepMlPerHour(4.8)).toBe(0.01);
    expect(pumpStepMlPerHour(99.99)).toBe(0.01);
    expect(pumpStepMlPerHour(100)).toBe(0.1);
    expect(pumpStepMlPerHour(250)).toBe(0.1);
  });
});

describe("tolerance odvozená z prostředku", () => {
  it("objem ve stříkačce kopíruje ISO 7886-1", () => {
    const tolerance = tolerances.syringeVolume(1.5);
    expect(tolerance.kind).toBe("absolute");
    expect(tolerance.kind === "absolute" && tolerance.value).toBeCloseTo(0.075, 10);
  });

  it("rychlost na pumpě je relativní, protože přesnost je v procentech", () => {
    expect(tolerances.pumpRate()).toEqual({ kind: "relative", value: 0.02 });
  });

  it("u kapek prochází zaokrouhlení nahoru i dolů", () => {
    const tolerance = tolerances.drops();
    expect(evaluateAnswer(62, 62.5, tolerance).correct).toBe(true);
    expect(evaluateAnswer(63, 62.5, tolerance).correct).toBe(true);
    expect(evaluateAnswer(34, 33.33, tolerance).correct).toBe(false);
  });

  it("odpověď mimo přesnost stříkačky neprojde", () => {
    const tolerance = tolerances.syringeVolume(1.5);
    expect(evaluateAnswer(1.55, 1.5, tolerance).correct).toBe(true);
    expect(evaluateAnswer(1.6, 1.5, tolerance).correct).toBe(false);
  });
})
