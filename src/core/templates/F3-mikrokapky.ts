import { dropsPerMinute, infusionRateMlPerHour } from "../formulas";
import { DROP_FACTOR_SOURCE, MICRODRIP_FACTOR } from "../devices";
import { pickProduct } from "../products";
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
export const F3 = register({
  id: "F3",
  category: "infuze",
  source: [SUKL_DLP, DROP_FACTOR_SOURCE],

  generate(rng, difficulty) {
    const product = pickProduct(rng, { kind: "infusionBag", minVolumeMl: 1 });
    const bagMl = product.packUnitVolumeMl ?? 500;
    const hours = difficulty === 1 ? rng.pick([1, 2, 4, 8] as const) : rng.step(0.5, 12, 0.5);

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
