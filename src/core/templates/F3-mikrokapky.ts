import { dropsPerMinute, infusionRateMlPerHour } from "../formulas";
import { DROP_FACTOR_SOURCE, MICRODRIP_FACTOR } from "../devices";
import { BASE_SOLUTION_ATC, pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * F3 — mikrokapkový set 60 gtt/ml.
 *
 * Při faktoru 60 se počet kapek za minutu číselně rovná rychlosti v ml/h.
 * Není to náhoda: hodina má šedesát minut a mililitr šedesát kapek, takže
 * se obojí vykrátí. Šablona vede řešení tak, aby to bylo vidět, ne aby
 * si uživatel pamatoval pravidlo.
 */
/** Nejvyšší rychlost, pro kterou se mikrokapkový set v zadání použije. */
const MAX_MICRODRIP_ML_H = 100;

export const F3 = register({
  id: "F3",
  category: "infuze",
  source: [SUKL_DLP, DROP_FACTOR_SOURCE],

  generate(rng, difficulty) {
    const product = pickProduct(rng, { kind: "infusionBag", minVolumeMl: 1, atcPrefixes: BASE_SOLUTION_ATC });
    const bagMl = product.packUnitVolumeMl ?? 500;
    /**
     * Mikrokapkový set je na malé rychlosti; 60 kapek za minutu je 60 ml/h.
     * Nad 100 ml/h by kapky nešly spočítat, a tak se doba volí tak, aby
     * rychlost pod touhle hranicí zůstala.
     */
    const minHours = Math.ceil(bagMl / MAX_MICRODRIP_ML_H / 0.5) * 0.5;
    const hours =
      difficulty === 1
        ? rng.pick([1, 2, 4, 5, 8, 10, 12, 24].filter((h) => h >= minHours))
        : rng.step(Math.max(0.5, minHours), Math.max(12, minHours + 6), 0.5);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      bagMl,
      hours,
      dropFactor: MICRODRIP_FACTOR,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const bagMl = Number(vars.bagMl);
    const minutes = Number(vars.hours) * 60;
    const rate = infusionRateMlPerHour(bagMl, minutes);
    const drops = dropsPerMinute(bagMl, MICRODRIP_FACTOR, minutes);

    return {
      value: drops,
      steps: [
        given(q(bagMl, "ml", 0), q(minutes, "min", 0), `${MICRODRIP_FACTOR}${" "}\\mathrm{gtt/ml}`),
        formula(`\\text{gtt/min} = ${frac("V \\times \\text{@dropFactor}", "t")}`),
        substitute(`\\text{gtt/min} = ${frac(`${q(bagMl, "ml", 0)} \\times ${q(60, "gtt/ml", 0)}`, q(minutes, "min", 0))}`),
        intermediate("mikrokapkyRovnostMlH", { result: `${q(drops, "gtt/min", 1)} = ${q(rate, "ml/h", 1)}` }),
        result(drops, "gtt/min", 0),
      ],
      roundingNoteKey: "zaokrouhleniKapky",
    };
  },

  answer: { unit: "dropsPerMinute", tolerance: tolerances.drops(), decimals: 0 },
});
