import { vialContentMg } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";
import { realisticDilution } from "./perfusor";

/**
 * G4 — kolik ampulí do stříkačky.
 *
 * Zadaná je cílová koncentrace v perfuzoru, hledá se počet ampulí.
 * Odpovídá tomu, co se doopravdy dělá u lůžka: koncentrace je daná
 * zvyklostí oddělení, ampule se dopočítají.
 */
export const G4 = register({
  id: "G4",
  category: "vazoaktivni",
  source: SUKL_DLP,

  generate(rng) {
    // Ředění, které se pro dávku ze SPC opravdu chystá (perfusor.ts).
    // Cílová koncentrace se odvodí od celého počtu ampulí, aby zadání
    // vedlo na celé číslo a nešlo o hádání zlomků.
    const { product, syringeMl, ampoules } = realisticDilution(rng);
    const contentMg = vialContentMg(product);
    const targetConcentration = Number(((contentMg * ampoules) / syringeMl).toPrecision(4));

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      ampouleMg: contentMg,
      ampouleMl: product.packUnitVolumeMl ?? product.volumeMl ?? 1,
      syringeMl,
      targetConcentration,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const ampouleMg = Number(vars.ampouleMg);
    const syringeMl = Number(vars.syringeMl);
    const target = Number(vars.targetConcentration);

    const totalMg = target * syringeMl;
    const ampoules = Math.round(totalMg / ampouleMg);

    return {
      value: ampoules,
      steps: [
        given(q(target, "mg/ml", 3), q(syringeMl, "ml", 0), `${q(ampouleMg, "mg", 2)}\\text{/amp}`),
        intermediate("potrebneMnozstvi", {
          formula: `m = c \\times V`,
          substituted: `m = ${q(target, "mg/ml", 3)} \\times ${q(syringeMl, "ml", 0)}`,
          result: q(totalMg, "mg", 2),
        }),
        formula(`n = ${frac("m", "m_{\\text{@ampoule}}")}`),
        substitute(`n = ${frac(q(totalMg, "mg", 2), q(ampouleMg, "mg", 2))}`),
        result(ampoules, "amp", 0),
      ],
      roundingNoteKey: "zaokrouhleniAmpule",
    };
  },

  answer: { unit: "ampoule", tolerance: tolerances.countable(), decimals: 0 },
});
