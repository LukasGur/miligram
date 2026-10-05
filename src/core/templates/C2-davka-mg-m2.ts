import { bsaBasedDose } from "../formulas";
import { dosingRule, dosingSource, type DosingRuleId } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, q, result, substitute } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";

const RULES: readonly DosingRuleId[] = ["paklitaxel", "karboplatina"];

/**
 * C2 — dávka v mg/m².
 *
 * Povrch těla je v zadání hotový, počítá se jen dávka. Rozdělení C1 a C2
 * je záměrné: dvoukrokové zadání skryje, kde se stala chyba.
 */
export const C2 = register({
  id: "C2",
  category: "povrch",
  source: RULES.map(dosingSource),

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const range = rule.single!;

    const bsaM2 = difficulty === 1 ? rng.step(1.6, 2, 0.1) : rng.step(1.2, 2.3, 0.01);
    const perM2 = difficulty === 1
      ? rng.pick([range.min, range.max])
      : rng.step(range.min, range.max, 5);

    return {
      ruleId,
      productName: packageLabel(rule.product),
      substance: rule.substance,
      code: rule.suklCode,
      rangeMin: range.min,
      rangeMax: range.max,
      perM2,
      bsaM2,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const perM2 = Number(vars.perM2);
    const bsaM2 = Number(vars.bsaM2);
    const doseMg = bsaBasedDose(perM2, bsaM2);

    return {
      value: doseMg,
      steps: [
        given(q(bsaM2, "m^2", 2), q(perM2, "mg/m^2", 0)),
        formula(`m = D_{\\text{m}^2} \\times BSA`),
        substitute(`m = ${q(perM2, "mg/m^2", 0)} \\times ${q(bsaM2, "m^2", 2)}`),
        result(doseMg, "mg", 1),
      ],
      roundingNoteKey: "zaokrouhleniOnkologie",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mg", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
