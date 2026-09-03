import { pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * A7 — kolik balení na celou kúru.
 *
 * Otázka z ambulance, ne od lůžka: kolik krabiček předepsat, aby pacient
 * dobral. Zaokrouhluje se nahoru, protože polovinu krabičky lékárna nevydá.
 */
export const A7 = register({
  id: "A7",
  category: "zaklad",
  source: SUKL_DLP,

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "tablet",
      strengthUnit: "mg",
      minStrength: 1,
    });
    const perDose = difficulty === 1 ? 1 : rng.pick([0.5, 1, 2] as const);
    const timesPerDay = rng.pick([1, 2, 3] as const);
    const days = difficulty === 1 ? rng.pick([7, 14, 28] as const) : rng.int(5, 90);
    const packCount = product.packCount ?? 30;

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      strengthMg: product.strength,
      packCount,
      perDose,
      timesPerDay,
      days,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const perDose = Number(vars.perDose);
    const timesPerDay = Number(vars.timesPerDay);
    const days = Number(vars.days);
    const packCount = Number(vars.packCount);

    const totalTablets = perDose * timesPerDay * days;
    const packs = Math.ceil(totalTablets / packCount - 1e-9);

    return {
      value: packs,
      steps: [
        given(`${q(perDose, "tbl", 1)} \\times ${timesPerDay}\\text{/den}`, `${days}\\text{ dní}`, `${packCount}\\text{ tbl/bal.}`),
        intermediate("celkovaSpotreba", {
          formula: `n_{\\text{tbl}} = \\text{dávka} \\times \\text{frekvence} \\times \\text{dny}`,
          substituted: `n_{\\text{tbl}} = ${q(perDose, "", 1)} \\times ${timesPerDay} \\times ${days}`,
          result: q(totalTablets, "tbl", 1),
        }),
        formula(`n_{\\text{bal.}} = \\left\\lceil ${frac("n_{\\text{tbl}}", "\\text{obsah balení}")} \\right\\rceil`),
        substitute(`n_{\\text{bal.}} = \\left\\lceil ${frac(q(totalTablets, "", 1), String(packCount))} \\right\\rceil`),
        result(packs, "bal.", 0),
      ],
      roundingNoteKey: "zaokrouhleniBaleni",
    };
  },

  answer: { unit: "pack", tolerance: tolerances.countable(), decimals: 0 },
});
