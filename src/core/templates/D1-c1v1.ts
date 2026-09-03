import { volumeOfStock } from "../formulas";
import { syringeFor } from "../devices";
import { concentrationOf, pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { ISO_7886, register, SUKL_DLP } from "./registry";

/** Cílové objemy, ve kterých se roztoky na oddělení běžně připravují. */
const TARGET_VOLUMES_ML = [50, 100, 250, 500] as const;

/**
 * D1 — kolik koncentrátu na daný objem zředěného roztoku.
 *
 * Rovnice C₁V₁ = C₂V₂ vyřešená pro V₁. Nejčastější chyba je dosadit
 * cílový objem místo objemu koncentrátu, proto řešení obě veličiny
 * pojmenovává, ne jen indexuje.
 */
export const D1 = register({
  id: "D1",
  category: "redeni",
  source: [SUKL_DLP, ISO_7886],

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "concentrate",
      strengthUnit: "mg",
      minStrength: 10,
    });
    const stockConcentration = concentrationOf(product);

    const targetVolumeMl = rng.pick(TARGET_VOLUMES_ML);
    // Cílová koncentrace je vždy zlomek výchozí, jinak by ředění nedávalo smysl.
    const ratio = difficulty === 1 ? rng.pick([0.1, 0.25, 0.5] as const) : rng.step(0.05, 0.6, 0.05);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      stockConcentration,
      targetConcentration: Number((stockConcentration * ratio).toPrecision(3)),
      targetVolumeMl,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const c1 = Number(vars.stockConcentration);
    const c2 = Number(vars.targetConcentration);
    const v2 = Number(vars.targetVolumeMl);
    const v1 = volumeOfStock(c1, c2, v2);

    return {
      value: v1,
      steps: [
        given(`c_1 = ${q(c1, "mg/ml", 2)}`, `c_2 = ${q(c2, "mg/ml", 3)}`, `V_2 = ${q(v2, "ml", 0)}`),
        formula(`c_1 V_1 = c_2 V_2 \;\\Rightarrow\; V_1 = ${frac("c_2 V_2", "c_1")}`),
        substitute(`V_1 = ${frac(`${q(c2, "mg/ml", 3)} \\times ${q(v2, "ml", 0)}`, q(c1, "mg/ml", 2))}`),
        result(v1, "ml", 2),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    const capped = Math.min(solution.value, 50);
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(capped),
      decimals: (syringeFor(capped) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
