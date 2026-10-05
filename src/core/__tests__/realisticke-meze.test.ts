import { describe, expect, it } from "vitest";
import "../templates";
import { buildExercise } from "../templates";
import { productByCode } from "../products";
import { DOSING_RULE_LIST, dosingRule, type DosingRuleId } from "../products/dosing";
import { DIFFICULTIES } from "../types";

/**
 * Meze zadání pro šablony mimo B a D (docs/zdroje.md, oddíl 8).
 *
 * Správné číslo ze zdroje nestačí, dávka musí být taková, jakou by někdo
 * opravdu podal. Každý test prochází všechny tři úrovně na stovkách
 * semínek, protože extrémy vycházejí z kombinací, ne z jedné proměnné.
 */
const SEEDS = Array.from({ length: 300 }, (_, i) => `meze${i}`);

function* exercises(id: string) {
  for (const difficulty of DIFFICULTIES) {
    for (const seed of SEEDS) {
      yield { ...buildExercise(id, seed, difficulty), label: `${id}/${difficulty}/${seed}` };
    }
  }
}

function ruleByCode(code: string) {
  const found = DOSING_RULE_LIST.find(([, rule]) => rule.suklCode === code);
  expect(found, code).toBeDefined();
  return found![1];
}

describe("onkologie: dávka na m² ze SPC u dospělého pacienta", () => {
  it("C2, C3, L3: dávka na m² leží v rozmezí jednotlivé dávky ze SPC", () => {
    for (const [id, key] of [["C2", "perM2"], ["C3", "perM2"], ["L3", "fullDosePerM2"]] as const) {
      for (const { vars, label } of exercises(id)) {
        const range = dosingRule(vars.ruleId as DosingRuleId).single!;
        expect(Number(vars[key]), label).toBeGreaterThanOrEqual(range.min);
        expect(Number(vars[key]), label).toBeLessThanOrEqual(range.max);
      }
    }
  });

  it("C2, C5: povrch těla dospělého, 1,4–2,5 m²", () => {
    for (const id of ["C2", "C5"]) {
      for (const { vars, label } of exercises(id)) {
        expect(Number(vars.bsaM2), label).toBeGreaterThanOrEqual(1.4);
        expect(Number(vars.bsaM2), label).toBeLessThanOrEqual(2.5);
      }
    }
  });

  it("C5: strop je povrch 2,0 m², takže se uplatní jen u velkého pacienta", () => {
    let capped = 0;
    let free = 0;
    for (const { vars, solution, label } of exercises("C5")) {
      const range = ruleByCode(String(vars.code)).single!;
      const perM2 = Number(vars.perM2);
      const bsa = Number(vars.bsaM2);
      expect(perM2, label).toBeGreaterThanOrEqual(range.min);
      expect(perM2, label).toBeLessThanOrEqual(range.max);
      expect(Number(vars.capBsaM2), label).toBe(2);
      expect(solution.value, label).toBeCloseTo(perM2 * Math.min(bsa, 2), 6);
      if (bsa > 2) capped++;
      else free++;
    }
    // Strop se má uplatnit zhruba v polovině zadání, jinak by se opisoval.
    expect(capped).toBeGreaterThan(SEEDS.length);
    expect(free).toBeGreaterThan(SEEDS.length);
  });

  it("L1, L2, J3: karboplatina nejvýš 1050 mg, tedy AUC 7 × (125 + 25)", () => {
    for (const { solution, label } of exercises("L1")) {
      expect(solution.value, label).toBeLessThanOrEqual(1050);
    }
    for (const { vars, solution, label } of exercises("L2")) {
      expect(Number(vars.gfrMlPerMin), label).toBeLessThanOrEqual(125);
      expect(solution.value * Number(vars.concentration), label).toBeLessThanOrEqual(1050);
    }
    for (const { solution, label } of exercises("J3")) {
      expect(solution.value, label).toBeLessThanOrEqual(1050);
    }
  });
});

describe("ředění a infuze v objemu, jaký se podává", () => {
  it("E3: meropenem do vaku nejvýš 250 ml, ne do litru", () => {
    for (const { vars, solution, label } of exercises("E3")) {
      expect(solution.value, label).toBeLessThanOrEqual(250);
      expect(Number(vars.targetMgPerMl), label).toBeGreaterThanOrEqual(Number(vars.rangeMin));
      expect(Number(vars.targetMgPerMl), label).toBeLessThanOrEqual(Number(vars.rangeMax));
    }
  });

  it("F5: rychlost z kapek nejvýš 500 ml/h jako v F1 a F2", () => {
    for (const { solution, label } of exercises("F5")) {
      expect(solution.value, label).toBeLessThanOrEqual(500);
    }
  });
});

describe("perfuzory v rozmezí dávek ze SPC", () => {
  it("G1: noradrenalin v µg/min z rozmezí SPC", () => {
    const range = dosingRule("noradrenalin").single!;
    for (const { vars, label } of exercises("G1")) {
      expect(Number(vars.dosePerMin), label).toBeGreaterThanOrEqual(range.min);
      expect(Number(vars.dosePerMin), label).toBeLessThanOrEqual(range.max);
    }
  });

  it("G2, G5: dopamin a dobutamin v µg/kg/min z rozmezí SPC", () => {
    for (const [id, keys] of [["G2", ["dosePerKgMin"]], ["G5", ["fromDose", "toDose"]]] as const) {
      for (const { vars, label } of exercises(id)) {
        const range = dosingRule(vars.ruleId as DosingRuleId).single!;
        for (const key of keys) {
          expect(Number(vars[key]), `${label} ${key}`).toBeGreaterThanOrEqual(range.min);
          expect(Number(vars[key]), `${label} ${key}`).toBeLessThanOrEqual(range.max);
        }
      }
    }
  });

  it("G3: rychlost na pumpě odpovídá dávce z rozmezí SPC", () => {
    for (const { vars, solution, label } of exercises("G3")) {
      const range = dosingRule(vars.ruleId as DosingRuleId).single!;
      // Rychlost je zaokrouhlená na desetiny ml/h, dávka z ní se o kousek posune.
      expect(solution.value, label).toBeGreaterThanOrEqual(range.min * 0.95);
      expect(solution.value, label).toBeLessThanOrEqual(range.max * 1.05);
    }
  });
});

describe("inzulin v dávce, jakou jde podat naráz", () => {
  it("H3, I1, I2: rychlý inzulin nejvýš 30 IU, bazální a směsný nejvýš 60 IU", () => {
    let rapid = 0;
    for (const id of ["H3", "I1", "I2"]) {
      for (const { vars, label } of exercises(id)) {
        const product = productByCode(String(vars.code));
        if (!product.atc.startsWith("A10A")) continue;
        const isRapid = product.atc.startsWith("A10AB");
        if (isRapid) rapid++;
        expect(Number(vars.doseIU), `${label} ${product.name}`).toBeLessThanOrEqual(isRapid ? 30 : 60);
      }
    }
    expect(rapid).toBeGreaterThan(0);
  });
});

describe("dítě, pro které citace SPC platí", () => {
  it("B1, K4: ceftriaxon 50–80 mg/kg jen od 4,5 kg, ne novorozenci do 14 dnů", () => {
    let seen = 0;
    for (const id of ["B1", "K4"]) {
      for (const { vars, label } of exercises(id)) {
        if (vars.ruleId !== "ceftriaxonDeti") continue;
        seen++;
        expect(Number(vars.weightKg), label).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
