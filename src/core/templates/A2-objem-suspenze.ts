import { doseVolume } from "../formulas";
import { syringeFor } from "../devices";
import { concentrationOf, pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute, tidy } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * A2 — objem perorální suspenze z dávky v mg.
 *
 * Sirup se dávkuje odměrkou nebo stříkačkou, takže výsledek musí padnout
 * do objemu, který jde reálně odměřit. Dávka se proto losuje jako podíl
 * obsahu jednoho balení, ne jako volné číslo.
 */
export const A2 = register({
  id: "A2",
  category: "zaklad",
  source: SUKL_DLP,

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "oralLiquid",
      strengthUnit: "mg",
      minStrength: 1,
    });
    const concentration = concentrationOf(product);

    // Objem na jedno podání: L1 kulatý, dál po půl mililitru.
    const volumeMl = difficulty === 1
      ? rng.pick([2.5, 5, 10] as const)
      : rng.step(1, 15, 0.5);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      strengthMg: product.strength,
      referenceMl: product.volumeMl ?? 1,
      concentrationMgPerMl: concentration,
      doseMg: tidy(concentration * volumeMl),
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseMg = Number(vars.doseMg);
    const strengthMg = Number(vars.strengthMg);
    const referenceMl = Number(vars.referenceMl);
    const volumeMl = doseVolume(doseMg, strengthMg, referenceMl);

    return {
      value: volumeMl,
      steps: [
        given(q(doseMg, "mg", 3), `${q(strengthMg, "mg")} / ${q(referenceMl, "ml", 0)}`),
        formula(`V = ${frac("\\text{dávka}", "\\text{síla}")} \\times V_{\\text{ref}}`),
        substitute(`V = ${frac(q(doseMg, "mg", 3), q(strengthMg, "mg"))} \\times ${q(referenceMl, "ml", 0)}`),
        result(volumeMl, "ml", 1),
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
