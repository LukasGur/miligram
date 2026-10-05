import { unitsForDose } from "../formulas";
import { doseSourceFor, dosedProducts, pickDose, tabletCount } from "./ampouleDoses";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/** Dělitelnost, kterou snese běžná tableta s půlicí rýhou. */

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

  sourceFor: doseSourceFor,

  generate(rng, difficulty) {
    // Dávka ze SPC do 3 mg, kde zápis v mikrogramech dává smysl
    // (digoxin 125 µg); 10 000 µg by nikdo nenapsal. Půlka jen u tablety,
    // kterou lze podle SPC dělit.
    const { item, doseMg } = pickDose(rng, dosedProducts("tablet"), (dose, candidate) => {
      const count = tabletCount(dose, candidate);
      return dose <= 3 && count !== null && (difficulty !== 1 || Number.isInteger(count));
    });

    return {
      code: item.product.code,
      productName: item.product.name,
      substance: item.product.substance,
      strengthMg: item.contentMg,
      doseMg,
      doseUg: Number((doseMg * 1000).toFixed(3)),
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
