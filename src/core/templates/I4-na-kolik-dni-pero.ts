import { pickProduct, vialContentMg } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * I4 — na kolik dní vystačí zásobní vložka.
 *
 * Obsah pera není na obalu v jednotkách, ale v mililitrech — 3 ml při
 * 100 IU/ml je 300 IU. Zbytek, který na celý den nestačí, se nepočítá:
 * pacient si nemůže vzít půl dávky proto, že v peru došlo.
 */
export const I4 = register({
  id: "I4",
  category: "inzulin",
  source: SUKL_DLP,

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "ampoule",
      strengthUnit: "IU",
      minStrength: 100,
      maxStrength: 300,
      atcPrefixes: ["A10A"],
    });
    const contentIU = vialContentMg(product);

    // Denní dávka se volí tak, aby vložka vydržela aspoň tři dny —
    // kratší interval by nebyl příklad, ale chyba v ordinaci.
    const maxDaily = Math.floor(contentIU / 3);
    const dailyIU = difficulty === 1
      ? rng.step(10, Math.min(60, maxDaily), 10)
      : difficulty === 2
        ? rng.step(12, Math.min(80, maxDaily), 2)
        : rng.step(13, Math.min(90, maxDaily), 1);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      perMl: product.strength,
      cartridgeMl: product.packUnitVolumeMl ?? product.volumeMl ?? 1,
      contentIU,
      dailyIU,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const contentIU = Number(vars.contentIU);
    const dailyIU = Number(vars.dailyIU);
    const perMl = Number(vars.perMl);
    const cartridgeMl = Number(vars.cartridgeMl);
    const days = Math.floor(contentIU / dailyIU);

    return {
      value: days,
      steps: [
        given(q(cartridgeMl, "ml", 1), `${q(perMl, "IU", 0)}\\text{/ml}`, `${q(dailyIU, "IU", 0)}\\text{/den}`),
        intermediate("obsahVlozky", {
          substituted: `${q(cartridgeMl, "ml", 1)} \\times ${q(perMl, "IU", 0)}\\text{/ml}`,
          result: q(contentIU, "IU", 0),
        }),
        formula(`n = \\left\\lfloor ${frac("\\text{obsah}", "\\text{denní dávka}")} \\right\\rfloor`),
        substitute(`n = \\left\\lfloor ${frac(q(contentIU, "IU", 0), q(dailyIU, "IU", 0))} \\right\\rfloor`),
        result(days, "\\text{dní}", 0),
      ],
      roundingNoteKey: "zaokrouhleniDolu",
    };
  },

  answer: { unit: "den", tolerance: tolerances.countable(), decimals: 0 },
});
