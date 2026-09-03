import { massInVolume } from "../formulas";
import { concentrationOf, selectProducts } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * A8 — kolik pacient dostal.
 *
 * Obrácený směr: známe podaný objem, ptáme se na dávku. Odpovídá situaci,
 * kdy se dohledává, co se skutečně aplikovalo — a nutí to použít vzorec
 * pozpátku místo naučeného postupu.
 */
export const A8 = register({
  id: "A8",
  category: "zaklad",
  source: SUKL_DLP,

  generate(rng, difficulty) {
    /**
     * Na třetí úrovni se odpověď chce v gramech, takže dávka musí být
     * dost velká, aby v gramech vůbec šla rozumně zapsat. Bez téhle
     * podmínky vycházely odpovědi typu 0,0005 g.
     */
    const kind = rng.pick(["ampoule", "oralLiquid"] as const);
    const candidates = selectProducts({
      kind,
      strengthUnit: "mg",
      minStrength: 1,
    }).filter((p) => (difficulty === 3 ? concentrationOf(p) >= 20 : true));

    const product = rng.pick(candidates);
    const concentration = concentrationOf(product);
    const givenMl = difficulty === 1
      ? rng.pick([1, 2, 5] as const)
      : difficulty === 3
        ? rng.step(5, 10, 0.5)
        : rng.step(0.5, 10, 0.5);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      strengthMg: product.strength,
      referenceMl: product.volumeMl ?? 1,
      concentrationMgPerMl: concentration,
      givenMl,
      // Na třetí úrovni se odpověď chce v gramech.
      answerUnit: difficulty === 3 ? "g" : "mg",
    } satisfies Vars;
  },

  solve(vars, difficulty): Solution {
    const concentration = Number(vars.concentrationMgPerMl);
    const givenMl = Number(vars.givenMl);
    const doseMg = massInVolume(concentration, givenMl);
    const value = difficulty === 3 ? doseMg / 1000 : doseMg;
    const symbol = difficulty === 3 ? "g" : "mg";

    return {
      value,
      steps: [
        given(`${q(Number(vars.strengthMg), "mg", 3)} / ${q(Number(vars.referenceMl), "ml", 1)}`, q(givenMl, "ml", 1)),
        formula(`m = c \\times V`),
        substitute(`m = ${q(concentration, "mg/ml", 3)} \\times ${q(givenMl, "ml", 1)}`, q(doseMg, "mg", 2)),
        ...(difficulty === 3
          ? [substitute(`m = ${q(doseMg, "mg", 2)} = ${q(value, "g", 4)}`)]
          : []),
        result(value, symbol, difficulty === 3 ? 4 : 2),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(vars, solution) {
    const tolerance = tolerances.intermediate();
    return {
      unit: vars.answerUnit === "g" ? "g" : "mg",
      tolerance,
      decimals: tolerances.decimalsFor(solution.value, tolerance),
    };
  },
});
