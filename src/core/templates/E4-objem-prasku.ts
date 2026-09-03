import { reconstitutedConcentration } from "../formulas";
import { pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * E4 — prášek zabírá objem.
 *
 * Výsledný objem není objem rozpouštědla: sám lyofilizát něco zabere,
 * takže koncentrace vyjde nižší, než by z prostého dělení vycházelo.
 * Objem prášku je v zadání — je to údaj z příbalové informace konkrétní
 * šarže a aplikace ho netvrdí.
 */
export const E4 = register({
  id: "E4",
  category: "rekonstituce",
  source: SUKL_DLP,

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "powderVial",
      strengthUnit: "mg",
      minStrength: 250,
      maxStrength: 2000,
    });
    const diluentMl = rng.pick([5, 10, 20] as const);

    /**
     * Objem prášku je zhruba desetina až pětina objemu rozpouštědla;
     * losuje se po desetinách, aby rozdíl proti prostému dělení byl
     * vidět, ale zůstal realistický.
     */
    const displacementMl = difficulty === 1
      ? rng.pick([0.5, 1] as const)
      : rng.step(0.2, Math.max(0.4, diluentMl * 0.2), 0.1);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      vialMg: product.strength,
      diluentMl,
      displacementMl,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const vialMg = Number(vars.vialMg);
    const diluentMl = Number(vars.diluentMl);
    const displacementMl = Number(vars.displacementMl);

    const totalMl = diluentMl + displacementMl;
    const concentration = reconstitutedConcentration(vialMg, diluentMl, displacementMl);

    return {
      value: concentration,
      steps: [
        given(q(vialMg, "mg", 0), q(diluentMl, "ml", 1), `V_{\\text{@powder}} = ${q(displacementMl, "ml", 1)}`),
        intermediate("celkovyObjem", {
          formula: `V_{\\text{@total}} = V_{\\text{@diluent}} + V_{\\text{@powder}}`,
          substituted: `V_{\\text{@total}} = ${q(diluentMl, "ml", 1)} + ${q(displacementMl, "ml", 1)}`,
          result: q(totalMl, "ml", 1),
        }),
        formula(`c = ${frac("m", "V_{\\text{@total}}")}`),
        substitute(`c = ${frac(q(vialMg, "mg", 0), q(totalMl, "ml", 1))}`),
        result(concentration, "mg/ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mgPerMl", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
