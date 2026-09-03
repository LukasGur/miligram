import { concentrationOf, pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { ISO_7886, register, SUKL_DLP } from "./registry";

/** Koncentrace, ke které student sklouzne, i když v zadání není. */
const HABITUAL_IU_PER_ML = 100;

/**
 * I2 — tatáž ordinace při koncentraci 40 IU/ml.
 *
 * U-40 inzuliny jsou v ČR pořád registrované, takže „100 IU/ml“ není
 * konstanta, ale údaj z obalu. Když se přehlédne, vyjde objem dva a půl
 * krát menší, než má být. Krokové řešení proto ukazuje obě čísla vedle
 * sebe — ne aby se počítala dvakrát, ale aby byl rozdíl vidět.
 */
export const I2 = register({
  id: "I2",
  category: "inzulin",
  source: [SUKL_DLP, ISO_7886],

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "ampoule",
      strengthUnit: "IU",
      minStrength: 40,
      maxStrength: 40,
      atcPrefixes: ["A10A"],
    });

    const doseIU = difficulty === 1
      ? rng.step(4, 40, 4)
      : difficulty === 2
        ? rng.step(6, 48, 2)
        : rng.step(7, 60, 1);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      perMl: concentrationOf(product),
      doseIU,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseIU = Number(vars.doseIU);
    const perMl = Number(vars.perMl);
    const volumeMl = doseIU / perMl;
    const habitualMl = doseIU / HABITUAL_IU_PER_ML;

    return {
      value: volumeMl,
      steps: [
        given(q(doseIU, "IU", 0), `${q(perMl, "IU", 0)}\\text{/ml}`),
        formula(`V = ${frac("\\text{ordinace}", "\\text{koncentrace}")}`),
        substitute(`V = ${frac(q(doseIU, "IU", 0), `${q(perMl, "IU", 0)}\\text{/ml}`)}`),
        intermediate("porovnaniKoncentraci", {
          substituted: `${frac(q(doseIU, "IU", 0), `${q(HABITUAL_IU_PER_ML, "IU", 0)}\\text{/ml}`)} = ${q(habitualMl, "ml", 2)}`,
        }),
        result(volumeMl, "ml", 2),
      ],
      roundingNoteKey: "zaokrouhleniInzulinka",
    };
  },

  answer(_vars, solution) {
    return { unit: "ml", tolerance: tolerances.syringeVolume(solution.value), decimals: 2 };
  },
});
