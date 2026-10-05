import { massInVolume, percentToMgPerMl } from "../formulas";
import { concentrationOf, selectProducts } from "../products";
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
    // Jen hotové infuzní vaky. Koncentrát se pacientovi nepodává, ten se
    // nejdřív ředí — a „pacient dostal 500 ml TAXOTERE“ dávalo 10 g
    // docetaxelu, mnohonásobek smrtelné dávky.
    const product = rng.pick(
      selectProducts({ kind: "infusionBag", strengthUnit: "mg", minStrength: 1 }).filter(
        (bag) => bag.packUnitVolumeMl !== undefined && bag.packUnitVolumeMl >= 50,
      ),
    );
    const concentration = concentrationOf(product);
    const percent = concentration / 10;

    // Nejvýš obsah jednoho vaku podle SÚKL: na první úrovni celý vak,
    // výš i jeho část, třeba když infuzi zastavili dřív.
    const bagMl = product.packUnitVolumeMl ?? 100;
    const volumeMl = difficulty === 1 ? bagMl : rng.step(10, bagMl, 10);

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
