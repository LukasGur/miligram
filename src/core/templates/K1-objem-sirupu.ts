import { dividedDose } from "../formulas";
import { dosingRule, dosingSource, liquidPresentationOf, type DosingRuleId } from "../products/dosing";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { ISO_7886, register } from "./registry";
import { packageLabel } from "../products/label";

/** Perorální přípravky, u kterých SPC uvádí denní dávku i počet podání. */
const RULES: readonly DosingRuleId[] = ["ibuprofenDeti", "amoxicilin", "amoxicilinKlavulanat"];

/**
 * K1 — kolik mililitrů sirupu na jedno podání.
 *
 * Nejběžnější pediatrický výpočet a zároveň nejdelší řetěz: z mg/kg/den
 * přes denní dávku a dílčí dávku na mililitry. Každý článek je místo,
 * kde se dá spadnout o řád, a poslední z nich je jediný, který sestra
 * skutečně natáhne do stříkačky.
 */
export const K1 = register({
  id: "K1",
  category: "pediatrie",
  source: [...RULES.map((id) => dosingSource(id)), ISO_7886],

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const presentation = liquidPresentationOf(ruleId);
    const range = rule.daily;
    if (!range) throw new Error(`Pravidlo ${ruleId} nemá denní rozmezí.`);

    const weightKg = difficulty === 1 ? rng.step(10, 30, 5) : rng.step(6, 38, 0.5);
    const mgPerKgPerDay = difficulty === 1
      ? range.min
      : rng.step(range.min, range.max, difficulty === 2 ? 5 : 1);
    const dosesPerDay = rng.pick(rule.dosesPerDay ?? [3]);

    return {
      ruleId,
      productName: packageLabel(rule.product),
      substance: rule.substance,
      code: rule.suklCode,
      strengthMg: presentation.strengthMg,
      referenceMl: presentation.referenceMl,
      concentration: presentation.strengthMg / presentation.referenceMl,
      weightKg,
      mgPerKgPerDay,
      dosesPerDay,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const weightKg = Number(vars.weightKg);
    const mgPerKgPerDay = Number(vars.mgPerKgPerDay);
    const dosesPerDay = Number(vars.dosesPerDay);
    const concentration = Number(vars.concentration);

    const dailyMg = mgPerKgPerDay * weightKg;
    const singleMg = dividedDose(mgPerKgPerDay, weightKg, dosesPerDay);
    const volumeMl = singleMg / concentration;

    return {
      value: volumeMl,
      steps: [
        given(q(weightKg, "kg", 1), q(mgPerKgPerDay, "mg/kg/@day", 1), `${tex(dosesPerDay, 0)}\\times\\ \\text{@daily}`),
        intermediate("denniDavka", {
          substituted: `${q(mgPerKgPerDay, "mg/kg/@day", 1)} \\times ${q(weightKg, "kg", 1)}`,
          result: q(dailyMg, "mg", 1),
        }),
        intermediate("dilciDavka", {
          substituted: `${frac(q(dailyMg, "mg", 1), tex(dosesPerDay, 0))}`,
          result: q(singleMg, "mg", 1),
        }),
        formula(`V = ${frac("\\text{@singleDose}", "\\text{@concentration}")}`),
        substitute(`V = ${frac(q(singleMg, "mg", 1), `${q(concentration, "mg/ml", 1)}`)}`),
        result(volumeMl, "ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(Math.min(solution.value, 50)),
      decimals: (syringeFor(Math.min(solution.value, 50)) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
