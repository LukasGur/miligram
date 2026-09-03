import { infusionTimeMinutes } from "../formulas";
import { PUMP_SOURCE } from "../devices";
import { pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * F4 — za jak dlouho infuze dokape.
 *
 * Obrácený směr k F1. Odpověď je v minutách, i když je rychlost v ml/h —
 * převod je součástí úlohy, ne otázkou navíc.
 */
export const F4 = register({
  id: "F4",
  category: "infuze",
  source: [SUKL_DLP, PUMP_SOURCE],

  generate(rng, difficulty) {
    const product = pickProduct(rng, { kind: "infusionBag", minVolumeMl: 1 });
    const bagMl = product.packUnitVolumeMl ?? 500;

    const rateMlPerHour = difficulty === 1
      ? rng.pick([50, 100, 125, 250] as const)
      : rng.step(20, 300, 5);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      bagMl,
      rateMlPerHour,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const bagMl = Number(vars.bagMl);
    const rate = Number(vars.rateMlPerHour);
    const minutes = infusionTimeMinutes(bagMl, rate);

    return {
      value: minutes,
      steps: [
        given(q(bagMl, "ml", 0), q(rate, "ml/h", 0)),
        formula(`t = ${frac("V", "v")} \\times 60`),
        substitute(`t = ${frac(q(bagMl, "ml", 0), q(rate, "ml/h", 0))} \\times 60`),
        result(minutes, "min", 0),
      ],
      roundingNoteKey: "zaokrouhleniCas",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "min", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
