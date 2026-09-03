import { dividedDose, doseVolume } from "../formulas";
import { syringeFor } from "../devices";
import { dosingRule, dosingSource, presentationOf, type DosingRuleId } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { ISO_7886, register, SUKL_DLP } from "./registry";

/** Rozmezí, u kterých SPC uvádí denní dávku dělenou do podání. */
const RULES: readonly DosingRuleId[] = ["amoxicilin", "ibuprofenDeti", "amoxicilinKlavulanat"];

/**
 * B2 — denní dávka rozdělená do podání.
 *
 * Tři kroky: denní dávka, dílčí dávka, objem suspenze. Nejčastější chyba
 * je zapomenout dělit — proto je mezikrok v řešení vždy vidět zvlášť.
 */
export const B2 = register({
  id: "B2",
  category: "hmotnost",
  source: [SUKL_DLP, ISO_7886, ...RULES.map(dosingSource)],

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const range = rule.daily;
    if (!range) throw new Error(`Pravidlo ${ruleId} nemá denní dávku.`);

    const presentation = presentationOf(ruleId);
    const weightKg = difficulty === 1 ? rng.step(10, 30, 5) : rng.step(4, 40, 0.5);
    const perKgPerDay = difficulty === 1
      ? rng.pick([range.min, range.max])
      : rng.step(range.min, range.max, 5);
    const dosesPerDay = rng.pick(rule.dosesPerDay ?? [3]);

    return {
      ruleId,
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      strengthMg: presentation.strengthMg,
      referenceMl: presentation.referenceMl,
      rangeMin: range.min,
      rangeMax: range.max,
      perKgPerDay,
      dosesPerDay,
      weightKg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const perKgPerDay = Number(vars.perKgPerDay);
    const weightKg = Number(vars.weightKg);
    const dosesPerDay = Number(vars.dosesPerDay);
    const strengthMg = Number(vars.strengthMg);
    const referenceMl = Number(vars.referenceMl);

    const dailyMg = perKgPerDay * weightKg;
    const perDoseMg = dividedDose(perKgPerDay, weightKg, dosesPerDay);
    const volumeMl = doseVolume(perDoseMg, strengthMg, referenceMl);

    return {
      value: volumeMl,
      steps: [
        given(q(weightKg, "kg", 1), q(perKgPerDay, "mg/kg/den", 0), `${dosesPerDay}\\times\\text{ denně}`),
        intermediate("denniDavka", {
          formula: `m_{\\text{den}} = D_{\\text{kg/den}} \\times m_{\\text{tělesná}}`,
          substituted: `m_{\\text{den}} = ${q(perKgPerDay, "", 0)} \\times ${q(weightKg, "kg", 1)}`,
          result: q(dailyMg, "mg", 1),
        }),
        intermediate("dilciDavka", {
          formula: `m_{\\text{dávka}} = ${frac("m_{\\text{den}}", "n_{\\text{podání}}")}`,
          substituted: `m_{\\text{dávka}} = ${frac(q(dailyMg, "mg", 1), String(dosesPerDay))}`,
          result: q(perDoseMg, "mg", 1),
        }),
        formula(`V = ${frac("m_{\\text{dávka}}", "\\text{síla}")} \\times V_{\\text{ref}}`),
        substitute(`V = ${frac(q(perDoseMg, "mg", 1), q(strengthMg, "mg", 0))} \\times ${q(referenceMl, "ml", 0)}`),
        result(volumeMl, "ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(solution.value),
      decimals: (syringeFor(solution.value) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
