import { doseVolume, ratioToMgPerMl, weightBasedDose } from "../formulas";
import { syringeFor } from "../devices";
import { dosingRule, dosingSource } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { ISO_7886, register } from "./registry";

/**
 * D3 — poměrové ředění adrenalinu.
 *
 * Zápis 1:1000 znamená 1 g v 1000 ml, tedy 1 mg/ml. Je to jediné místo
 * v aplikaci, kde se koncentrace neuvádí číslem, a zároveň nejčastější
 * zdroj chyby o řád v resuscitaci — proto vlastní šablona.
 */
export const D3 = register({
  id: "D3",
  category: "redeni",
  source: [dosingSource("adrenalinResuscitace"), ISO_7886],

  generate(rng, difficulty) {
    const rule = dosingRule("adrenalinResuscitace");
    const range = rule.single!;

    const weightKg = difficulty === 1 ? rng.step(10, 70, 10) : rng.step(3, 90, 1);
    const perKg = difficulty === 1 ? range.min : rng.step(range.min, range.max, 0.005);
    // Ředění 1:1000 je ampule, 1:10 000 je ředěný roztok pro i.v. podání.
    const ratio = difficulty === 1 ? 1000 : rng.pick([1000, 10000] as const);

    return {
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      ratio,
      perKg,
      weightKg,
      maxSingleMg: rule.maxSingleMg ?? 1,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const ratio = Number(vars.ratio);
    const perKg = Number(vars.perKg);
    const weightKg = Number(vars.weightKg);
    const maxSingleMg = Number(vars.maxSingleMg);

    const concentration = ratioToMgPerMl(ratio);
    const computedMg = weightBasedDose(perKg, weightKg);
    const doseMg = Math.min(computedMg, maxSingleMg);
    const capped = computedMg > maxSingleMg;
    const volumeMl = doseVolume(doseMg, concentration, 1);

    return {
      value: volumeMl,
      steps: [
        given(`1:${ratio}`, q(weightKg, "kg", 0), q(perKg, "mg/kg", 3), `\\max ${q(maxSingleMg, "mg", 1)}`),
        intermediate("pomerNaKoncentraci", {
          formula: `1:${ratio} = ${frac("1\\,\\mathrm{g}", `${ratio}\\,\\mathrm{ml}`)}`,
          result: q(concentration, "mg/ml", 3),
        }),
        intermediate("davkaVMg", {
          substituted: `m = ${q(perKg, "mg/kg", 3)} \\times ${q(weightKg, "kg", 0)}`,
          result: q(computedMg, "mg", 3),
        }),
        // Strop ze zadání. Bez tohoto kroku by postup ukázal
        // „0,03 mg/kg × 72 kg = 1 mg“ a nebylo by vidět proč.
        intermediate(capped ? "stropSeUplatnil" : "stropSeNeuplatnil", {
          substituted: `\\min(${q(computedMg, "mg", 3)},\\; ${q(maxSingleMg, "mg", 1)})`,
          result: q(doseMg, "mg", 3),
        }),
        formula(`V = ${frac("m", "c")}`),
        substitute(`V = ${frac(q(doseMg, "mg", 3), q(concentration, "mg/ml", 3))}`),
        result(volumeMl, "ml", 2),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    const capped = Math.min(Math.max(solution.value, 0.05), 50);
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(capped),
      decimals: (syringeFor(capped) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
