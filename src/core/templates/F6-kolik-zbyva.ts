import { infusionTimeMinutes } from "../formulas";
import { PUMP_SOURCE } from "../devices";
import { BASE_SOLUTION_ATC, pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * F6 — kolik zbývá do dokapání.
 *
 * Infuze už nějakou dobu běží. Odpověď se dá získat dvěma cestami —
 * přes zbývající objem, nebo přes celkový čas mínus uplynulý — a řešení
 * ukazuje tu první, protože zbývající objem se dá odečíst z vaku.
 */
export const F6 = register({
  id: "F6",
  category: "infuze",
  source: [SUKL_DLP, PUMP_SOURCE],

  generate(rng, difficulty) {
    const product = pickProduct(rng, { kind: "infusionBag", minVolumeMl: 1, atcPrefixes: BASE_SOLUTION_ATC });
    const bagMl = product.packUnitVolumeMl ?? 500;
    const rateMlPerHour = difficulty === 1
      ? rng.pick([50, 100, 125] as const)
      : rng.step(20, 250, 5);

    const totalMinutes = infusionTimeMinutes(bagMl, rateMlPerHour);
    // Uplynulý čas je vždy menší než celkový, jinak by otázka neměla smysl.
    const elapsedShare = difficulty === 1 ? rng.pick([0.25, 0.5] as const) : rng.step(0.1, 0.8, 0.05);
    const elapsedMinutes = Math.round(totalMinutes * elapsedShare / 5) * 5;

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      bagMl,
      rateMlPerHour,
      elapsedMinutes: Math.max(5, elapsedMinutes),
    } satisfies Vars;
  },

  solve(vars): Solution {
    const bagMl = Number(vars.bagMl);
    const rate = Number(vars.rateMlPerHour);
    const elapsed = Number(vars.elapsedMinutes);

    const infusedMl = (rate * elapsed) / 60;
    const remainingMl = bagMl - infusedMl;
    const remainingMinutes = infusionTimeMinutes(remainingMl, rate);

    return {
      value: remainingMinutes,
      steps: [
        given(q(bagMl, "ml", 0), q(rate, "ml/h", 0), `${q(elapsed, "min", 0)}\\text{ @elapsed}`),
        intermediate("podanyObjem", {
          formula: `V_{\\text{@given}} = \\dfrac{v \\times t}{60}`,
          substituted: `V_{\\text{@given}} = \\dfrac{${q(rate, "ml/h", 0)} \\times ${q(elapsed, "min", 0)}}{${q(60, "min/h", 0)}}`,
          result: q(infusedMl, "ml", 1),
        }),
        intermediate("zbyvajiciObjem", {
          substituted: `V_{\\text{@remaining}} = ${q(bagMl, "ml", 0)} - ${q(infusedMl, "ml", 1)}`,
          result: q(remainingMl, "ml", 1),
        }),
        formula(`t_{\\text{@remaining}} = \\dfrac{V_{\\text{@remaining}}}{v} \\times 60`),
        substitute(`t_{\\text{@remaining}} = \\dfrac{${q(remainingMl, "ml", 1)}}{${q(rate, "ml/h", 0)}} \\times ${q(60, "min/h", 0)}`),
        result(remainingMinutes, "min", 0),
      ],
      roundingNoteKey: "zaokrouhleniCas",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "min", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
