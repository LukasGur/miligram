import { dosingRule, dosingSource, liquidPresentationOf, type DosingRuleId } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

const RULES: readonly DosingRuleId[] = ["ibuprofenDeti", "ibuprofenBaby", "amoxicilin", "amoxicilinKlavulanat"];

/**
 * K5 — odpovídá předepsaný objem dávce podle SPC?
 *
 * Obrácený chod výpočtu, a v praxi ten důležitější: na receptu je počet
 * mililitrů a otázka zní, kolik mg/kg/den z něj plyne. Teprve to jde
 * porovnat s rozmezím v SPC. Šablona počítá jen tu hodnotu — posoudit
 * ji je krok, který dělá člověk.
 */
export const K5 = register({
  id: "K5",
  category: "pediatrie",
  source: RULES.map((id) => dosingSource(id)),

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const presentation = liquidPresentationOf(ruleId);
    const concentration = presentation.strengthMg / presentation.referenceMl;
    const range = rule.daily ?? rule.single;
    if (!range) throw new Error(`Pravidlo ${ruleId} nemá dávkovací rozmezí.`);

    const weightKg = difficulty === 1 ? rng.step(10, 30, 5) : rng.step(6, 36, 0.5);
    const dosesPerDay = rng.pick(rule.dosesPerDay ?? [3]);

    /**
     * Objem se odvodí z rozmezí v SPC a teprve pak zaokrouhlí na hodnotu,
     * kterou jde předepsat. Zaokrouhlení je tu schválně: právě kvůli němu
     * skutečná dávka nesedí přesně na to, co lékař zamýšlel, a kontrola
     * má co odhalit.
     */
    const intendedPerKgPerDay = rng.step(range.min, range.max, 1);
    const rawMl = (intendedPerKgPerDay * weightKg) / dosesPerDay / concentration;
    const prescribedMl = Math.max(0.5, Math.round(rawMl * 2) / 2);

    return {
      ruleId,
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      concentration,
      weightKg,
      dosesPerDay,
      prescribedMl,
      rangeMin: range.min,
      rangeMax: range.max,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const concentration = Number(vars.concentration);
    const prescribedMl = Number(vars.prescribedMl);
    const dosesPerDay = Number(vars.dosesPerDay);
    const weightKg = Number(vars.weightKg);

    const singleMg = prescribedMl * concentration;
    const dailyMg = singleMg * dosesPerDay;
    const perKgPerDay = dailyMg / weightKg;

    return {
      value: perKgPerDay,
      steps: [
        given(q(prescribedMl, "ml", 1), `${tex(dosesPerDay, 0)}\\times\\ \\text{@daily}`, q(weightKg, "kg", 1)),
        intermediate("dilciDavka", {
          substituted: `${tex(prescribedMl, 1)} \\times ${tex(concentration, 1)}`,
          result: q(singleMg, "mg", 1),
        }),
        intermediate("denniDavka", {
          substituted: `${tex(singleMg, 1)} \\times ${tex(dosesPerDay, 0)}`,
          result: q(dailyMg, "mg", 1),
        }),
        formula(`d_{kg} = ${frac("\\text{@dailyDose}", "m")}`),
        substitute(`d_{kg} = ${frac(q(dailyMg, "mg", 1), q(weightKg, "kg", 1))}`),
        result(perKgPerDay, "mg/kg/@day", 1),
      ],
      roundingNoteKey: "zaokrouhleniKontrola",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mgPerKgDen", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance, 2) };
  },
});
