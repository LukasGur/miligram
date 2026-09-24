import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { doseSourceFor, dosedProducts, moreThanContent, pickDose } from "./ampouleDoses";
import { register, SUKL_DLP } from "./registry";

/**
 * A4 — počet ampulí na dávku.
 *
 * Dávka přesahuje obsah jedné ampule. Zaokrouhluje se vždy nahoru: půl
 * ampule navíc se otevřít musí, i když se z ní většina vyhodí.
 */
export const A4 = register({
  id: "A4",
  category: "zaklad",
  source: SUKL_DLP,

  sourceFor: doseSourceFor,

  generate(rng, difficulty) {
    // Ordinace ze SPC, která přesahuje jednu ampuli. Na první úrovni
    // jen celé násobky, na třetí jen dávky, po kterých v poslední
    // ampuli něco zbude — tam se teprve pozná, kdo zaokrouhluje nahoru.
    const { item, doseMg } = pickDose(rng, dosedProducts("ampoule"), (dose, candidate) => {
      if (!moreThanContent(dose, candidate)) return false;
      const ratio = dose / candidate.contentMg;
      const whole = Math.abs(ratio - Math.round(ratio)) < 1e-9;
      if (difficulty === 1) return whole;
      if (difficulty === 3) return !whole;
      return true;
    });

    return {
      code: item.product.code,
      productName: item.product.name,
      substance: item.product.substance,
      ampouleMg: item.contentMg,
      ampouleMl: item.contentMl,
      doseMg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseMg = Number(vars.doseMg);
    const ampouleMg = Number(vars.ampouleMg);
    const exact = doseMg / ampouleMg;
    const count = Math.ceil(exact - 1e-9);

    return {
      value: count,
      steps: [
        given(q(doseMg, "mg", 3), `${q(ampouleMg, "mg", 3)}\\text{/amp}`),
        formula(`n = \\left\\lceil ${frac("\\text{@dose}", "\\text{@ampouleContent}")} \\right\\rceil`),
        substitute(`n = \\left\\lceil ${frac(q(doseMg, "mg", 3), q(ampouleMg, "mg", 3))} \\right\\rceil`),
        intermediate("zaokrouhleniNahoru", { result: `\\left\\lceil ${q(exact, "", 2)} \\right\\rceil = ${count}` }),
        result(count, "amp", 0),
      ],
      roundingNoteKey: "zaokrouhleniAmpule",
    };
  },

  answer: { unit: "ampoule", tolerance: tolerances.countable(), decimals: 0 },
});
