import { infusionRateMlPerHour } from "../formulas";
import { PUMP_SOURCE } from "../devices";
import { CARRIER_SOURCE, pickCarrier, pickFitting, range, rateFits } from "../products/carriers";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { register } from "./registry";

/**
 * F1 — rychlost infuze v ml/h.
 *
 * Nejběžnější výpočet u lůžka. Nástraha je v jednotkách: objem je v ml,
 * čas v hodinách, ale mezikrok se počítá v minutách.
 */
export const F1 = register({
  id: "F1",
  category: "infuze",
  source: [CARRIER_SOURCE, PUMP_SOURCE],

  generate(rng, difficulty) {
    const product = pickCarrier(rng);
    const bagMl = product.packUnitVolumeMl ?? 500;

    const hours = pickFitting(
      rng,
      difficulty === 1 ? [2, 4, 6, 8, 12, 24] : range(0.5, 24, 0.5),
      (h) => rateFits(bagMl / h),
    );

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      bagMl,
      hours,
      // Na třetí úrovni je čas zadaný v minutách.
      timeUnit: difficulty === 3 ? "min" : "h",
      timeShown: difficulty === 3 ? hours * 60 : hours,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const bagMl = Number(vars.bagMl);
    const hours = Number(vars.hours);
    const minutes = hours * 60;
    const rate = infusionRateMlPerHour(bagMl, minutes);

    return {
      value: rate,
      steps: [
        given(q(bagMl, "ml", 0), q(hours, "h", 1)),
        formula(`v = ${frac("V", "t")}`),
        substitute(`v = ${frac(q(bagMl, "ml", 0), q(hours, "h", 1))}`),
        result(rate, "ml/h", 1),
      ],
      roundingNoteKey: "zaokrouhleniPumpa",
    };
  },

  answer: { unit: "mlPerHour", tolerance: tolerances.pumpRate(), decimals: 1 },
});
