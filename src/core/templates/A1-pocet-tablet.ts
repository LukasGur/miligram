import { unitsForDose } from "../formulas";
import { pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute, tex, unit } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/** Násobky síly tablety, které dávají dělitelnou dávku. */
const MULTIPLES = {
  1: [1, 2] as const,
  2: [0.5, 1.5, 2, 3] as const,
  3: [0.5, 1, 1.5, 2] as const,
};

/**
 * A1 — počet tablet z předepsané dávky.
 *
 * Nejjednodušší výpočet v aplikaci a záměrně první, se kterým se uživatel
 * potká. Na třetí úrovni je dávka v gramech, takže se nedá jen vydělit.
 */
export const A1 = register({
  id: "A1",
  category: "zaklad",
  source: SUKL_DLP,

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "tablet",
      strengthUnit: "mg",
      minStrength: 1,
      maxStrength: 1000,
    });
    const multiple = rng.pick(MULTIPLES[difficulty]);
    const doseMg = product.strength * multiple;

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      strengthMg: product.strength,
      doseMg,
      doseUnit: difficulty === 3 ? "g" : "mg",
      doseShown: difficulty === 3 ? doseMg / 1000 : doseMg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseMg = Number(vars.doseMg);
    const strengthMg = Number(vars.strengthMg);
    const count = unitsForDose(doseMg, strengthMg);

    return {
      value: count,
      steps: [
        given(q(doseMg, "mg", 3), `${tex(strengthMg)}${unit("mg")}\\text{/tbl}`),
        formula(`n = ${frac("\\text{@dose}", "\\text{@tabletStrength}")}`),
        substitute(`n = ${frac(q(doseMg, "mg", 3), q(strengthMg, "mg"))}`),
        result(count, "tbl", 2),
      ],
      roundingNoteKey: "zaokrouhleniTablety",
    };
  },

  answer: { unit: "tablet", tolerance: tolerances.countable(), decimals: 2 },
});
