import { unitsForDose } from "../formulas";
import { doseSourceFor, dosedProducts, pickDose, tabletCount } from "./ampouleDoses";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute, tex, unit } from "./helpers";
import { register, SUKL_DLP } from "./registry";

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

  sourceFor: doseSourceFor,

  generate(rng, difficulty) {
    /**
     * Ordinace je dávka ze SPC vylosované tablety, ne násobek její síly:
     * dřív vycházelo třeba 180 mg gliklazidu (nejvýš 120 mg denně) nebo
     * 1,5 tablety, kterou podle SPC rozdělit nejde. Jedna celá tableta
     * se nezadává — odpověď by stála v zadání. Na třetí úrovni je dávka
     * v gramech, a tak jen od 100 mg výš.
     */
    const { item, doseMg } = pickDose(rng, dosedProducts("tablet"), (dose, candidate) => {
      const count = tabletCount(dose, candidate);
      if (count === null || count === 1) return false;
      if (difficulty === 1 && !Number.isInteger(count)) return false;
      return difficulty !== 3 || dose >= 100;
    });

    return {
      code: item.product.code,
      productName: item.product.name,
      substance: item.product.substance,
      strengthMg: item.contentMg,
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
