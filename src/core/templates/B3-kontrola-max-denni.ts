import { weightBasedDose } from "../formulas";
import { dosingRule, dosingSource, type DosingRuleId } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, intermediate, q, result, substitute } from "./helpers";
import { register } from "./registry";

const RULES: readonly DosingRuleId[] = ["ibuprofenBaby", "paracetamolDeti", "gentamicin"];

/**
 * B3 — kolik smí pacient ještě dnes dostat.
 *
 * Otázka nemíří na dávku, ale na zbývající prostor do denního stropu.
 * Je to bezpečnostní úvaha, kterou mechanický výpočet dávky přeskočí.
 */
export const B3 = register({
  id: "B3",
  category: "hmotnost",
  source: RULES.map(dosingSource),

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const limit = rule.maxDaily;
    if (!limit) throw new Error(`Pravidlo ${ruleId} nemá maximální denní dávku.`);

    const weightKg = difficulty === 1 ? rng.step(10, 30, 5) : rng.step(4, 45, 0.5);
    const maxDailyMg = weightBasedDose(limit.min, weightKg);

    // Kolik už pacient dnes dostal — vždy pod stropem, jinak by otázka
    // neměla smysl a odpověď by byla záporná.
    const usedShare = difficulty === 1 ? rng.pick([0.5, 0.75] as const) : rng.step(0.2, 0.85, 0.05);
    const dosesGiven = rng.pick([1, 2, 3] as const);
    const perDoseMg = Number(((maxDailyMg * usedShare) / dosesGiven).toPrecision(3));

    return {
      ruleId,
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      limitPerKg: limit.min,
      weightKg,
      dosesGiven,
      perDoseMg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const limitPerKg = Number(vars.limitPerKg);
    const weightKg = Number(vars.weightKg);
    const dosesGiven = Number(vars.dosesGiven);
    const perDoseMg = Number(vars.perDoseMg);

    const maxDailyMg = weightBasedDose(limitPerKg, weightKg);
    const givenMg = perDoseMg * dosesGiven;
    const remainingMg = maxDailyMg - givenMg;

    return {
      value: remainingMg,
      steps: [
        given(q(weightKg, "kg", 1), q(limitPerKg, "mg/kg/@day", 1), `${dosesGiven} \\times ${q(perDoseMg, "mg", 1)}`),
        intermediate("denniStrop", {
          formula: `m_{\\max} = D_{\\max} \\times m_{\\text{@body}}`,
          substituted: `m_{\\max} = ${q(limitPerKg, "mg/kg/@day", 1)} \\times ${q(weightKg, "kg", 1)}`,
          result: q(maxDailyMg, "mg", 1),
        }),
        intermediate("jizPodano", {
          substituted: `m_{\\text{@given}} = ${dosesGiven} \\times ${q(perDoseMg, "mg", 1)}`,
          result: q(givenMg, "mg", 1),
        }),
        formula(`m_{\\text{@remaining}} = m_{\\max} - m_{\\text{@given}}`),
        substitute(`m_{\\text{@remaining}} = ${q(maxDailyMg, "mg", 1)} - ${q(givenMg, "mg", 1)}`),
        result(remainingMg, "mg", 1),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mg", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
