import { massInVolume } from "../formulas";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, q, result, substitute } from "./helpers";
import { doseSourceFor, dosedProducts, pickDose, roundVolume } from "./ampouleDoses";
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

  sourceFor: doseSourceFor,

  generate(rng, difficulty) {
    /**
     * Podaný objem odpovídá dávce pro dospělého ze SPC — v dokumentaci
     * se nedohledává 10 ml depotního neuroleptika, ale to, co se skutečně
     * podává. Na třetí úrovni se odpověď chce v gramech, takže jen dávky
     * od 100 mg; menší by v gramech vycházely jako 0,0005 g.
     *
     * Dávka se nesmí rovnat síle v referenčním objemu — „10 mg v 1 ml,
     * podán 1 ml“ má odpověď přímo v zadání a nic se nepočítá.
     */
    const kind = rng.pick(["ampoule", "oralLiquid"] as const);
    const { item, doseMg } = pickDose(rng, dosedProducts(kind), (dose, candidate) =>
      Math.abs(dose - candidate.product.strength) > 1e-9 &&
      roundVolume(dose, candidate, 0.01) &&
      (difficulty !== 1 || roundVolume(dose, candidate, 0.5)) &&
      (difficulty !== 3 || dose >= 100),
    );
    const givenMl = Number((doseMg / item.concentrationMgPerMl).toFixed(2));

    return {
      code: item.product.code,
      productName: item.product.name,
      substance: item.product.substance,
      strengthMg: item.product.strength,
      referenceMl: item.product.volumeMl ?? 1,
      concentrationMgPerMl: item.concentrationMgPerMl,
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
        given(`${q(Number(vars.strengthMg), "mg", 3)} / ${q(Number(vars.referenceMl), "ml", 1)}`, q(givenMl, "ml", 2)),
        formula(`m = c \\times V`),
        substitute(`m = ${q(concentration, "mg/ml", 3)} \\times ${q(givenMl, "ml", 2)}`, q(doseMg, "mg", 2)),
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
