import { pickProduct, vialContentMg } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tidy } from "./helpers";
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

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "ampoule",
      strengthUnit: "mg",
      minStrength: 1,
      maxVolumeMl: 20,
    });
    const contentMg = vialContentMg(product);

    // Na první úrovni vychází celý počet ampulí, dál zbytek zůstává.
    const multiple = difficulty === 1
      ? rng.pick([2, 3, 4] as const)
      : rng.step(1.2, 4.8, 0.1);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      ampouleMg: contentMg,
      ampouleMl: product.packUnitVolumeMl ?? product.volumeMl ?? 1,
      doseMg: tidy(contentMg * multiple),
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
