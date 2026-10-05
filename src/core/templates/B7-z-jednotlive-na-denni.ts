import { weightBasedDose } from "../formulas";
import { dosingRule, dosingSource, type DosingRuleId } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, intermediate, orderStep, q, result, substitute } from "./helpers";
import { register } from "./registry";

const RULES: readonly DosingRuleId[] = ["paracetamolDeti", "ibuprofenBaby"];

/**
 * B7 — z jednotlivé dávky na denní.
 *
 * Opačný směr než B2. Jednotlivá dávka může být v rozmezí a přesto denní
 * strop překročit, když se podá příliš často — tohle je ten případ.
 * Odpověď je denní dávka na kilogram, aby šla přímo porovnat s limitem.
 */
export const B7 = register({
  id: "B7",
  category: "hmotnost",
  source: RULES.map(dosingSource),

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const single = rule.single!;

    const weightKg = difficulty === 1 ? rng.step(10, 30, 5) : rng.step(Math.max(4, rule.minWeightKg ?? 0), 45, 0.5);
    const perDoseMg = Number(
      (weightBasedDose(
        difficulty === 1 ? rng.pick([single.min, single.max]) : rng.step(single.min, single.max, orderStep(single)),
        weightKg,
      )).toPrecision(3),
    );
    const timesPerDay = rng.pick([3, 4, 5, 6] as const);

    return {
      ruleId,
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      limitPerKg: rule.maxDaily!.min,
      weightKg,
      perDoseMg,
      timesPerDay,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const weightKg = Number(vars.weightKg);
    const perDoseMg = Number(vars.perDoseMg);
    const timesPerDay = Number(vars.timesPerDay);

    const dailyMg = perDoseMg * timesPerDay;
    const dailyPerKg = dailyMg / weightKg;

    return {
      value: dailyPerKg,
      steps: [
        given(q(weightKg, "kg", 1), `${timesPerDay} \\times ${q(perDoseMg, "mg", 1)}`),
        intermediate("denniDavka", {
          substituted: `m_{\\text{@day}} = ${timesPerDay} \\times ${q(perDoseMg, "mg", 1)}`,
          result: q(dailyMg, "mg", 1),
        }),
        formula(`D_{\\text{kg/@day}} = \\dfrac{m_{\\text{@day}}}{m_{\\text{@body}}}`),
        substitute(`D_{\\text{kg/@day}} = \\dfrac{${q(dailyMg, "mg", 1)}}{${q(weightKg, "kg", 1)}}`),
        result(dailyPerKg, "mg/kg/@day", 1),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mgPerKgDen", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
