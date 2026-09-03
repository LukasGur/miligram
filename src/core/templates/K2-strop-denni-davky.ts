import { dosingRule, dosingSource, liquidPresentationOf, type DosingRuleId } from "../products/dosing";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { ISO_7886, register } from "./registry";

/** Pravidla, kde SPC uvádí nepřekročitelnou denní dávku i objemové balení. */
const RULES: readonly DosingRuleId[] = ["ibuprofenBaby", "gentamicin"];

/**
 * K2 — kolik nejvíc smí být v jedné dávce.
 *
 * Opačná otázka než K1: ne „kolik podat“, ale „kde je strop“. Maximální
 * denní dávka je v SPC tvrdý limit, ne doporučení, a po vydělení počtem
 * podání dává objem, který se nesmí překročit. Pro dítě je to jediný
 * mantinel, který zbývá — dávkovací rozmezí se u něj mění s hmotností.
 */
export const K2 = register({
  id: "K2",
  category: "pediatrie",
  source: [...RULES.map((id) => dosingSource(id)), ISO_7886],

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const presentation = liquidPresentationOf(ruleId);
    if (!rule.maxDaily) throw new Error(`Pravidlo ${ruleId} nemá maximální denní dávku.`);

    const weightKg = difficulty === 1 ? rng.step(8, 24, 4) : rng.step(5, 35, 0.5);
    const dosesPerDay = rng.pick(rule.dosesPerDay ?? [3]);

    return {
      ruleId,
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      maxDailyPerKg: rule.maxDaily.min,
      concentration: presentation.strengthMg / presentation.referenceMl,
      weightKg,
      dosesPerDay,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const weightKg = Number(vars.weightKg);
    const maxDailyPerKg = Number(vars.maxDailyPerKg);
    const dosesPerDay = Number(vars.dosesPerDay);
    const concentration = Number(vars.concentration);

    const maxDailyMg = maxDailyPerKg * weightKg;
    const maxSingleMg = maxDailyMg / dosesPerDay;
    const volumeMl = maxSingleMg / concentration;

    return {
      value: volumeMl,
      steps: [
        given(q(weightKg, "kg", 1), `${tex(maxDailyPerKg, 1)}\\ \\mathrm{mg/kg/den}`, `${tex(dosesPerDay, 0)}\\times\\ \\text{@daily}`),
        intermediate("maximalniDenniDavka", {
          substituted: `${tex(maxDailyPerKg, 1)} \\times ${tex(weightKg, 1)}`,
          result: q(maxDailyMg, "mg", 1),
        }),
        intermediate("stropDilciDavky", {
          substituted: `${frac(q(maxDailyMg, "mg", 1), tex(dosesPerDay, 0))}`,
          result: q(maxSingleMg, "mg", 1),
        }),
        formula(`V_{\\max} = ${frac("\\text{@doseCap}", "\\text{@concentration}")}`),
        substitute(`V_{\\max} = ${frac(q(maxSingleMg, "mg", 1), q(concentration, "mg/ml", 1))}`),
        result(volumeMl, "ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniStropDolu",
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
