import { doseSourceFor, dosedProducts, moreThanContent, pickDose } from "./ampouleDoses";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * E5 — kolik lahviček otevřít.
 *
 * Zaokrouhlení nahoru, zbytek se znehodnotí. Otázka na počet lahviček
 * místo na objem odpovídá tomu, co se doopravdy objednává ze skladu.
 */
export const E5 = register({
  id: "E5",
  category: "rekonstituce",
  source: SUKL_DLP,

  sourceFor: doseSourceFor,

  generate(rng, difficulty) {
    /**
     * Dávka ze SPC, větší než obsah jedné lahvičky. Dřív se brala jako
     * náhodný násobek obsahu (2,9 g cefotaximu). Na první úrovni vyjde
     * celý počet lahviček, výš se zaokrouhluje nahoru.
     */
    const { item, doseMg } = pickDose(rng, dosedProducts("powderVial"), (dose, candidate) => {
      if (!moreThanContent(dose, candidate)) return false;
      const vials = dose / candidate.contentMg;
      return difficulty !== 1 || Math.abs(vials - Math.round(vials)) < 1e-9;
    });

    return {
      code: item.product.code,
      productName: item.product.name,
      substance: item.product.substance,
      vialMg: item.contentMg,
      doseMg,
      doseUnit: difficulty === 3 ? "g" : "mg",
      doseShown: difficulty === 3 ? doseMg / 1000 : doseMg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseMg = Number(vars.doseMg);
    const vialMg = Number(vars.vialMg);
    const exact = doseMg / vialMg;
    const vials = Math.ceil(exact - 1e-9);

    return {
      value: vials,
      steps: [
        given(q(doseMg, "mg", 1), `${q(vialMg, "mg", 0)}\\text{/@vial}`),
        formula(`n = \\left\\lceil ${frac("\\text{@dose}", "\\text{@vialContent}")} \\right\\rceil`),
        substitute(`n = \\left\\lceil ${frac(q(doseMg, "mg", 1), q(vialMg, "mg", 0))} \\right\\rceil`),
        intermediate("zaokrouhleniNahoru", {
          result: `\\left\\lceil ${q(exact, "", 2)} \\right\\rceil = ${vials}`,
        }),
        result(vials, "@vialShort", 0),
      ],
      roundingNoteKey: "zaokrouhleniLahvicky",
    };
  },

  answer: { unit: "vial", tolerance: tolerances.countable(), decimals: 0 },
});
