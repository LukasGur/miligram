import { concentrationOf, pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { ISO_7886, register, SUKL_DLP } from "./registry";

/**
 * I1 — objem inzulinu při běžné koncentraci 100 IU/ml.
 *
 * Inzulinová stříkačka je cejchovaná přímo v jednotkách, takže v praxi
 * se objem nepočítá. Počítá se ve chvíli, kdy se inzulin podává jinou
 * stříkačkou nebo ředí do infuze — a tam je záměna stupnice za mililitry
 * chyba o řád.
 */
export const I1 = register({
  id: "I1",
  category: "inzulin",
  source: [SUKL_DLP, ISO_7886],

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "ampoule",
      strengthUnit: "IU",
      minStrength: 100,
      maxStrength: 100,
      atcPrefixes: ["A10A"],
    });

    const doseIU = difficulty === 1
      ? rng.step(4, 40, 2)
      : difficulty === 2
        ? rng.step(3, 60, 1)
        : rng.step(7, 96, 1);

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

    return {
      value: volumeMl,
      steps: [
        given(q(doseIU, "IU", 0), `${q(perMl, "IU", 0)}\\text{/ml}`),
        formula(`V = ${frac("\\text{ordinace}", "\\text{koncentrace}")}`),
        substitute(`V = ${frac(q(doseIU, "IU", 0), `${q(perMl, "IU", 0)}\\text{/ml}`)}`),
        result(volumeMl, "ml", 2),
      ],
      roundingNoteKey: "zaokrouhleniInzulinka",
    };
  },

  answer(_vars, solution) {
    return { unit: "ml", tolerance: tolerances.syringeVolume(solution.value), decimals: 2 };
  },
});
