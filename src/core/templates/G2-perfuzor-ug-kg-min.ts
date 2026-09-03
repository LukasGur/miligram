import { microgramsPerKgMinToMlPerHour } from "../formulas";
import { PUMP_SOURCE } from "../devices";
import { concentrationOf, vialContentMg } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { frac, step, tex, unit } from "./helpers";
import { register, SUKL_DLP } from "./registry";
import { choosePerfusorDilution } from "./perfusor";

/**
 * G2 — kontinuální infuze v µg/kg/min.
 *
 * Nejnáročnější běžný převod: mění se čas i řád jednotky současně.
 * Zadaná dávka pochází z rozmezí, koncentrace z reálného ředění.
 */
export const G2 = register({
  id: "G2",
  category: "vazoaktivni",
  source: [SUKL_DLP, PUMP_SOURCE],

  generate(rng, difficulty) {
    const weightKg = rng.step(50, 95, 5);
    const dosePerKgMin = difficulty === 1
      ? rng.pick([2, 5, 10] as const)
      : rng.step(0.5, 20, 0.5);

    const dilution = choosePerfusorDilution(rng, { perKgMin: dosePerKgMin, weightKg });
    const { product, syringeMl, ampoules, totalMg, concentrationMgPerMl } = dilution;

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      ampouleMg: vialContentMg(product),
      ampouleMl: product.packUnitVolumeMl ?? product.volumeMl ?? 1,
      ampouleConcentration: concentrationOf(product),
      ampoules,
      syringeMl,
      totalMg,
      concentrationMgPerMl,
      weightKg,
      dosePerKgMin,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const totalMg = Number(vars.totalMg);
    const syringeMl = Number(vars.syringeMl);
    const weightKg = Number(vars.weightKg);
    const dose = Number(vars.dosePerKgMin);
    const concentration = totalMg / syringeMl;
    const rate = microgramsPerKgMinToMlPerHour(dose, weightKg, concentration);

    return {
      value: rate,
      steps: [
        step("zadani", {
          result: `${tex(totalMg, 1)}${unit("mg")} / ${tex(syringeMl, 0)}${unit("ml")},\; ${tex(weightKg, 0)}${unit("kg")},\; ${tex(dose, 2)}${unit("\\mu g/kg/min")}`,
        }),
        step("koncentrace", {
          formula: `c = ${frac("m", "V")}`,
          substituted: `c = ${frac(`${tex(totalMg, 1)}${unit("mg")}`, `${tex(syringeMl, 0)}${unit("ml")}`)}`,
          result: `c = ${tex(concentration, 3)}${unit("mg/ml")}`,
        }),
        step("vzorec", {
          formula: `\\text{ml/h} = ${frac("D \\times m_{\\text{@body}} \\times 60", "c \\times 1000")}`,
        }),
        step("dosazeni", {
          substituted: `\\text{ml/h} = ${frac(`${tex(dose, 2)} \\times ${tex(weightKg, 0)} \\times 60`, `${tex(concentration, 3)} \\times 1000`)}`,
        }),
        step("vysledek", { result: `${tex(rate, 2)}${unit("ml/h")}` }),
      ],
      roundingNoteKey: "zaokrouhleniPumpa",
    };
  },

  answer: { unit: "mlPerHour", tolerance: tolerances.pumpRate(), decimals: 2 },
});
