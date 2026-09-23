import { unitsForDose } from "../formulas";
import { pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/** Dělitelnost, kterou snese běžná tableta s půlicí rýhou. */
const FRACTIONS = [0.5, 1, 1.5, 2, 2.5, 3] as const;

/**
 * A5 — dělení tablety u dávky v mikrogramech.
 *
 * Síla je na krabičce v miligramech, dávka na receptu v mikrogramech.
 * Kdo převod přeskočí, splete se o tři řády — proto je tahle šablona
 * záměrně postavená kolem převodu, ne kolem dělení.
 */
export const A5 = register({
  id: "A5",
  category: "zaklad",
  source: SUKL_DLP,

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "tablet",
      strengthUnit: "mg",
      minStrength: 0.05,
      maxStrength: 5,
    });
    const fraction = difficulty === 1 ? rng.pick([1, 2] as const) : rng.pick(FRACTIONS);
    const doseMg = product.strength * fraction;

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      strengthMg: product.strength,
      doseMg,
      doseUg: doseMg * 1000,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseUg = Number(vars.doseUg);
    const doseMg = doseUg / 1000;
    const strengthMg = Number(vars.strengthMg);
    const count = unitsForDose(doseMg, strengthMg);

    return {
      value: count,
      steps: [
        given(q(doseUg, "µg", 1), `${q(strengthMg, "mg", 3)}\\text{/tbl}`),
        intermediate("prevodJednotek", {
          formula: `1${" "}\\mathrm{mg} = 1000${" "}\\mathrm{\\mu g}`,
          substituted: `${q(doseUg, "µg", 1)} = ${frac(q(doseUg, "µg", 1), q(1000, "µg/mg", 0))}`,
          result: q(doseMg, "mg", 4),
        }),
        formula(`n = ${frac("\\text{@dose}", "\\text{@tabletStrength}")}`),
        substitute(`n = ${frac(q(doseMg, "mg", 4), q(strengthMg, "mg", 3))}`),
        result(count, "tbl", 2),
      ],
      roundingNoteKey: "zaokrouhleniTablety",
    };
  },

  answer: { unit: "tablet", tolerance: tolerances.countable(), decimals: 2 },
});
