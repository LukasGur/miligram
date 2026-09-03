import { pickProduct, vialContentMg } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";
import { SYRINGE_VOLUMES_ML, VASOACTIVE_ATC } from "./perfusor";

/**
 * G6 — kolik ředidla natáhnout.
 *
 * Ampule už jsou ve stříkačce a zbytek do celkového objemu doplní
 * fyziologický roztok. Odpověď je rozdíl, ne celkový objem — stejná
 * past jako u D6, jen v perfuzoru.
 */
export const G6 = register({
  id: "G6",
  category: "vazoaktivni",
  source: SUKL_DLP,

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "concentrate",
      strengthUnit: "mg",
      atcPrefixes: VASOACTIVE_ATC,
    });
    const ampouleMl = product.packUnitVolumeMl ?? product.volumeMl ?? 1;
    const syringeMl = rng.pick(SYRINGE_VOLUMES_ML);

    // Počet ampulí se omezí tak, aby se do stříkačky vešly i s ředidlem.
    const maxAmpoules = Math.max(1, Math.floor((syringeMl * 0.6) / ampouleMl));
    const ampoules = difficulty === 1 ? 1 : rng.int(1, Math.min(6, maxAmpoules));

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      ampouleMg: vialContentMg(product),
      ampouleMl,
      ampoules,
      syringeMl,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const ampouleMl = Number(vars.ampouleMl);
    const ampoules = Number(vars.ampoules);
    const syringeMl = Number(vars.syringeMl);

    const drugMl = ampouleMl * ampoules;
    const diluentMl = syringeMl - drugMl;

    return {
      value: diluentMl,
      steps: [
        given(`${ampoules} \\times ${q(ampouleMl, "ml", 1)}`, `V_{\\text{celkem}} = ${q(syringeMl, "ml", 0)}`),
        intermediate("objemLeciva", {
          substituted: `V_{\\text{léčivo}} = ${ampoules} \\times ${q(ampouleMl, "ml", 1)}`,
          result: q(drugMl, "ml", 1),
        }),
        formula(`V_{\\text{ředidlo}} = V_{\\text{celkem}} - V_{\\text{léčivo}}`),
        substitute(`V_{\\text{ředidlo}} = ${q(syringeMl, "ml", 0)} - ${q(drugMl, "ml", 1)}`),
        result(diluentMl, "ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "ml", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
