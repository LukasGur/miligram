import { mixedConcentration } from "../formulas";
import { concentrationOf, pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

const TOTAL_VOLUMES_ML = [50, 100, 250, 500, 1000] as const;

/**
 * D4 — jaká koncentrace vyjde po naředění.
 *
 * Opačný směr než D1: objemy jsou dané, hledá se koncentrace. Odpovídá
 * situaci, kdy je roztok už připravený a je potřeba vědět, co v něm je.
 */
export const D4 = register({
  id: "D4",
  category: "redeni",
  source: SUKL_DLP,

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "concentrate",
      strengthUnit: "mg",
      minStrength: 1,
    });
    const stockConcentration = concentrationOf(product);
    const vialMl = product.packUnitVolumeMl ?? product.volumeMl ?? 1;

    const stockVolumeMl = difficulty === 1 ? vialMl : rng.step(1, Math.max(2, vialMl * 2), 0.5);
    const totalVolumeMl = rng.pick(TOTAL_VOLUMES_ML);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      stockConcentration,
      stockVolumeMl,
      totalVolumeMl,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const c1 = Number(vars.stockConcentration);
    const v1 = Number(vars.stockVolumeMl);
    const v2 = Number(vars.totalVolumeMl);
    const c2 = mixedConcentration([{ concentration: c1, volumeMl: v1 }], v2);

    return {
      value: c2,
      steps: [
        given(`c_1 = ${q(c1, "mg/ml", 2)}`, `V_1 = ${q(v1, "ml", 1)}`, `V_2 = ${q(v2, "ml", 0)}`),
        formula(`c_1 V_1 = c_2 V_2 \;\\Rightarrow\; c_2 = ${frac("c_1 V_1", "V_2")}`),
        substitute(`c_2 = ${frac(`${q(c1, "mg/ml", 2)} \\times ${q(v1, "ml", 1)}`, q(v2, "ml", 0))}`),
        result(c2, "mg/ml", 3),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mgPerMl", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
