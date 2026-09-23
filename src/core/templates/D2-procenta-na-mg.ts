import { massInVolume, percentToMgPerMl } from "../formulas";
import { concentrationOf, pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * D2 — kolik léčivé látky je v daném objemu procentního roztoku.
 *
 * Definice procentního roztoku je jediná věc, kterou je potřeba znát:
 * 1 % znamená 1 g ve 100 ml, tedy 10 mg/ml. Kdo si ji nepamatuje,
 * spočítá všechno ostatní správně a stejně se splete o řád.
 */
export const D2 = register({
  id: "D2",
  category: "redeni",
  source: SUKL_DLP,

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: rng.pick(["infusionBag", "concentrate"] as const),
      strengthUnit: "mg",
      minStrength: 1,
    });
    const concentration = concentrationOf(product);
    const percent = concentration / 10;

    const volumeMl = difficulty === 1
      ? rng.pick([100, 250, 500] as const)
      : rng.step(20, 1000, 10);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      percent: Number(percent.toPrecision(3)),
      concentrationMgPerMl: concentration,
      volumeMl,
      // Na třetí úrovni se odpověď chce v gramech.
      answerUnit: difficulty === 3 ? "g" : "mg",
    } satisfies Vars;
  },

  solve(vars, difficulty): Solution {
    const percent = Number(vars.percent);
    const volumeMl = Number(vars.volumeMl);
    const concentration = percentToMgPerMl(percent);
    const massMg = massInVolume(concentration, volumeMl);
    const value = difficulty === 3 ? massMg / 1000 : massMg;

    return {
      value,
      steps: [
        given(`${q(percent, "\\%", 2)}`, q(volumeMl, "ml", 0)),
        intermediate("procentaNaKoncentraci", {
          formula: `1\\,\\% = 1\\,\\mathrm{g}/100\\,\\mathrm{ml} = 10\\,\\mathrm{mg/ml}`,
          substituted: `c = ${tex(percent, 2)} \\times ${q(10, "mg/ml", 0)}`,
          result: q(concentration, "mg/ml", 2),
        }),
        formula(`m = c \\times V`),
        substitute(`m = ${q(concentration, "mg/ml", 2)} \\times ${q(volumeMl, "ml", 0)}`, q(massMg, "mg", 1)),
        // Na nejvyšší obtížnosti se ptáme v gramech. Převod musí stát
        // v postupu jako krok, jinak by „10 mg/ml × 360 ml = 3,6 g“
        // na kalkulačce nevyšlo a nebylo by vidět proč.
        ...(difficulty === 3
          ? [
              intermediate("prevodJednotek", {
                formula: `1\\,\\mathrm{g} = 1000\\,\\mathrm{mg}`,
                substituted: `m = ${frac(q(massMg, "mg", 1), q(1000, "mg/g", 0))}`,
                result: q(value, "g", 3),
              }),
            ]
          : []),
        result(value, difficulty === 3 ? "g" : "mg", difficulty === 3 ? 3 : 1),
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
