import { doseVolume } from "../formulas";
import { syringeFor } from "../devices";
import { pickProduct, vialContentMg } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tidy } from "./helpers";
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

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "ampoule",
      strengthUnit: "mg",
      minStrength: 1,
      maxVolumeMl: 20,
    });
    const contentMg = vialContentMg(product);
    const fraction = difficulty === 1 ? rng.pick([0.25, 0.5, 0.75] as const) : rng.step(0.15, 0.85, 0.05);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      ampouleMg: contentMg,
      ampouleMl: product.packUnitVolumeMl ?? product.volumeMl ?? 1,
      doseMg: tidy(contentMg * fraction),
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
          formula: `V_{\\text{odebráno}} = ${frac("\\text{dávka}", "\\text{obsah}")} \\times V_{\\text{ampule}}`,
          substituted: `V_{\\text{odebráno}} = ${frac(q(doseMg, "mg", 3), q(ampouleMg, "mg", 3))} \\times ${q(ampouleMl, "ml", 1)}`,
          result: q(takenMl, "ml", 2),
        }),
        formula(`V_{\\text{zbytek}} = V_{\\text{ampule}} - V_{\\text{odebráno}}`),
        substitute(`V_{\\text{zbytek}} = ${q(ampouleMl, "ml", 1)} - ${q(takenMl, "ml", 2)}`),
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
