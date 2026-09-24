import { concentrationOf, pickProduct } from "../products";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { ISO_7886, register, SUKL_DLP } from "./registry";

/** Přípravky značené v mezinárodních jednotkách, se kterými se počítá u lůžka. */
const ATC = ["A10AB", "A10AC", "A10AD", "A10AE", "B01AB01"] as const;

/**
 * H3 — kolik mililitrů odpovídá ordinaci v mezinárodních jednotkách.
 *
 * Aktivita se nedá přepočítat na hmotnost obecně, jen přes koncentraci
 * konkrétního přípravku — proto je síla vždy součástí zadání a nikdy se
 * nepředpokládá „obvyklých“ 100 IU/ml.
 */
export const H3 = register({
  id: "H3",
  category: "prevody",
  source: [SUKL_DLP, ISO_7886],

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "ampoule",
      strengthUnit: "IU",
      minStrength: 40,
      maxStrength: 5000,
      atcPrefixes: ATC,
    });
    const perMl = concentrationOf(product);

    // Objem se losuje první, aby ordinace vyšla na celé jednotky.
    // Přesně 1 ml se vynechává: ordinace by se rovnala síle v zadání
    // a odpověď by šla opsat bez počítání.
    const maxMl = Math.min(2, product.packUnitVolumeMl ?? 2);
    let volumeMl = 1;
    while (volumeMl === 1) {
      volumeMl = difficulty === 1
        ? rng.step(0.1, 0.9, 0.1)
        : rng.step(0.05, maxMl, 0.05);
    }
    const doseIU = Number((perMl * volumeMl).toFixed(2));

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      perMl,
      packMl: product.packUnitVolumeMl ?? product.volumeMl ?? 1,
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
        given(q(doseIU, "IU", 2), `${q(perMl, "IU", 0)}\\text{/ml}`),
        formula(`V = ${frac("\\text{@order}", "\\text{@activityPerMl}")}`),
        substitute(`V = ${frac(q(doseIU, "IU", 2), `${q(perMl, "IU", 0)}\\text{/ml}`)}`),
        result(volumeMl, "ml", 2),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(solution.value),
      decimals: (syringeFor(solution.value) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
