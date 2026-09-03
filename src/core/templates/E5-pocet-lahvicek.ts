import { pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tidy } from "./helpers";
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

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "powderVial",
      strengthUnit: "mg",
      minStrength: 100,
      maxStrength: 2000,
    });

    const multiple = difficulty === 1
      ? rng.pick([2, 3, 4] as const)
      : rng.step(1.1, 4.9, 0.1);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      vialMg: product.strength,
      doseMg: tidy(product.strength * multiple),
      doseUnit: difficulty === 3 ? "g" : "mg",
      doseShown: difficulty === 3 ? tidy(product.strength * multiple) / 1000 : tidy(product.strength * multiple),
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
