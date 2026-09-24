import { doseVolume } from "../formulas";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { doseSourceFor, dosedProducts, lessThanContent, pickDose, roundVolume } from "./ampouleDoses";
import { ISO_7886, register, SUKL_DLP } from "./registry";

/**
 * A6 — kolik v ampuli zbude.
 *
 * Stejná aritmetika jako A3, ale otázka míří na zbytek. Kdo počítá
 * mechanicky, odpoví odebraným objemem — proto ta šablona existuje.
 */
export const A6 = register({
  id: "A6",
  category: "zaklad",
  source: [SUKL_DLP, ISO_7886],

  sourceFor: doseSourceFor,

  generate(rng, difficulty) {
    // Podaná dávka ze SPC, menší než obsah ampule — jinak by nic nezbylo.
    const { item, doseMg } = pickDose(rng, dosedProducts("ampoule"), (dose, candidate) =>
      lessThanContent(dose, candidate) && (difficulty !== 1 || roundVolume(dose, candidate)),
    );

    return {
      code: item.product.code,
      productName: item.product.name,
      substance: item.product.substance,
      ampouleMg: item.contentMg,
      ampouleMl: item.contentMl,
      doseMg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseMg = Number(vars.doseMg);
    const ampouleMg = Number(vars.ampouleMg);
    const ampouleMl = Number(vars.ampouleMl);
    const takenMl = doseVolume(doseMg, ampouleMg, ampouleMl);
    const leftMl = ampouleMl - takenMl;

    return {
      value: leftMl,
      steps: [
        given(`${q(ampouleMg, "mg", 3)} / ${q(ampouleMl, "ml", 1)}`, q(doseMg, "mg", 3)),
        intermediate("odebranyObjem", {
          formula: `V_{\\text{@withdrawn}} = ${frac("\\text{@dose}", "\\text{@content}")} \\times V_{\\text{@ampoule}}`,
          substituted: `V_{\\text{@withdrawn}} = ${frac(q(doseMg, "mg", 3), q(ampouleMg, "mg", 3))} \\times ${q(ampouleMl, "ml", 1)}`,
          result: q(takenMl, "ml", 3),
        }),
        formula(`V_{\\text{@remainder}} = V_{\\text{@ampoule}} - V_{\\text{@withdrawn}}`),
        substitute(`V_{\\text{@remainder}} = ${q(ampouleMl, "ml", 1)} - ${q(takenMl, "ml", 3)}`),
        result(leftMl, "ml", 2),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(Math.max(solution.value, 0.05)),
      decimals: (syringeFor(Math.max(solution.value, 0.05)) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
