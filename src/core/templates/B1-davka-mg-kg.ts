import { weightBasedDose } from "../formulas";
import { dosingRule, dosingSource, type DosingRuleId } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, orderStep, q, result, substitute } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";

/** Rozmezí, u kterých SPC uvádí dávku na jedno podání v mg/kg. */
const RULES: readonly DosingRuleId[] = ["paracetamolDeti", "ibuprofenBaby", "ceftriaxonDeti"];

/**
 * B1 — jednotlivá dávka podle hmotnosti.
 *
 * Obvyklá dávka se tvrdit smí, protože pochází z bodu 4.2 SPC konkrétního
 * přípravku. Uživatel dostane rozmezí a jednu hodnotu z něj, ne holé číslo,
 * aby bylo vidět, že dávkování je interval, ne konstanta.
 */
export const B1 = register({
  id: "B1",
  category: "hmotnost",
  source: RULES.map(dosingSource),

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const range = rule.single;
    if (!range) throw new Error(`Pravidlo ${ruleId} nemá dávku na jedno podání.`);

    // Hmotnost odpovídá dětskému pacientovi, pro kterého jsou tahle SPC psaná.
    const weightKg = difficulty === 1 ? rng.step(10, 40, 5) : rng.step(Math.max(3.5, rule.minWeightKg ?? 0), 45, 0.5);
    const perKg = difficulty === 1
      ? rng.pick([range.min, range.max])
      : rng.step(range.min, range.max, orderStep(range));

    return {
      ruleId,
      productName: packageLabel(rule.product),
      substance: rule.substance,
      code: rule.suklCode,
      rangeMin: range.min,
      rangeMax: range.max,
      perKg,
      weightKg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const perKg = Number(vars.perKg);
    const weightKg = Number(vars.weightKg);
    const doseMg = weightBasedDose(perKg, weightKg);

    return {
      value: doseMg,
      steps: [
        given(q(weightKg, "kg", 1), `${q(perKg, "mg/kg", 1)}`),
        formula(`m = D_{\\text{kg}} \\times m_{\\text{@body}}`),
        substitute(`m = ${q(perKg, "mg/kg", 1)} \\times ${q(weightKg, "kg", 1)}`),
        result(doseMg, "mg", 1),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mg", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
