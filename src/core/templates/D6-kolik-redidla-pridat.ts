import { volumeOfStock } from "../formulas";
import { concentrationOf } from "../products";
import { dilutableConcentrates, dilutionTarget } from "./concentrateDraw";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

const TARGET_VOLUMES_ML = [50, 100, 250, 500] as const;

/**
 * D6 — kolik rozpouštědla přidat.
 *
 * Zdánlivě totéž co D1, ale otázka míří na rozdíl V₂ − V₁, ne na objem
 * koncentrátu. Kdo odpoví objemem koncentrátu, přidá do vaku o tolik víc,
 * kolik měl celkem vzniknout — proto to má vlastní šablonu.
 */
export const D6 = register({
  id: "D6",
  category: "redeni",
  source: SUKL_DLP,

  generate(rng, difficulty) {
    const product = rng.pick(dilutableConcentrates(10));
    const stockConcentration = concentrationOf(product);
    // Natahuje se z balení, ne podle poměru (concentrateDraw.ts).
    const { targetVolumeMl, targetConcentration } = dilutionTarget(
      rng,
      product,
      stockConcentration,
      difficulty,
      TARGET_VOLUMES_ML,
    );

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      stockConcentration,
      targetConcentration,
      targetVolumeMl,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const c1 = Number(vars.stockConcentration);
    const c2 = Number(vars.targetConcentration);
    const v2 = Number(vars.targetVolumeMl);

    const stockMl = volumeOfStock(c1, c2, v2);
    const diluentMl = v2 - stockMl;

    return {
      value: diluentMl,
      steps: [
        given(`c_1 = ${q(c1, "mg/ml", 2)}`, `c_2 = ${q(c2, "mg/ml", 3)}`, `V_2 = ${q(v2, "ml", 0)}`),
        intermediate("objemKoncentratu", {
          formula: `V_1 = ${frac("c_2 V_2", "c_1")}`,
          substituted: `V_1 = ${frac(`${q(c2, "mg/ml", 3)} \\times ${q(v2, "ml", 0)}`, q(c1, "mg/ml", 2))}`,
          result: q(stockMl, "ml", 2),
        }),
        formula(`V_{\\text{@diluent}} = V_2 - V_1`),
        substitute(`V_{\\text{@diluent}} = ${q(v2, "ml", 0)} - ${q(stockMl, "ml", 2)}`),
        result(diluentMl, "ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniObjemVaku",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "ml", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
