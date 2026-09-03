import { microgramsPerKgMinToMlPerHour } from "../formulas";
import { PUMP_SOURCE } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";
import { choosePerfusorDilution } from "./perfusor";

/**
 * G5 — o kolik ml/h změnit rychlost.
 *
 * Ředění zůstává, mění se dávka. Odpověď je rozdíl, ne nová rychlost —
 * nutí spočítat obě a zároveň odpovídá tomu, jak se ordinace zapisuje
 * („zvyš o dva mikrogramy“).
 */
export const G5 = register({
  id: "G5",
  category: "vazoaktivni",
  source: [SUKL_DLP, PUMP_SOURCE],

  generate(rng, difficulty) {
    const weightKg = rng.step(50, 95, 5);
    const fromDose = difficulty === 1 ? rng.pick([5, 10] as const) : rng.step(1, 15, 0.5);
    const step = difficulty === 1 ? rng.pick([2, 5] as const) : rng.step(0.5, 5, 0.5);
    const toDose = fromDose + step;

    // Ředění se volí podle vyšší dávky, aby ani po zvýšení pumpa nevyjela z rozsahu.
    const dilution = choosePerfusorDilution(rng, { perKgMin: toDose, weightKg });

    return {
      code: dilution.product.code,
      productName: dilution.product.name,
      substance: dilution.product.substance,
      ampoules: dilution.ampoules,
      syringeMl: dilution.syringeMl,
      totalMg: dilution.totalMg,
      concentrationMgPerMl: dilution.concentrationMgPerMl,
      weightKg,
      fromDose,
      toDose,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const concentration = Number(vars.totalMg) / Number(vars.syringeMl);
    const weightKg = Number(vars.weightKg);
    const fromDose = Number(vars.fromDose);
    const toDose = Number(vars.toDose);

    const fromRate = microgramsPerKgMinToMlPerHour(fromDose, weightKg, concentration);
    const toRate = microgramsPerKgMinToMlPerHour(toDose, weightKg, concentration);
    const difference = toRate - fromRate;

    return {
      value: difference,
      steps: [
        given(q(weightKg, "kg", 0), q(concentration, "mg/ml", 3), `${q(fromDose, "", 2)} \\to ${q(toDose, "\\mu g/kg/min", 2)}`),
        intermediate("puvodniRychlost", { result: `v_1 = ${q(fromRate, "ml/h", 2)}` }),
        intermediate("novaRychlost", { result: `v_2 = ${q(toRate, "ml/h", 2)}` }),
        formula(`\\Delta v = v_2 - v_1`),
        substitute(`\\Delta v = ${q(toRate, "ml/h", 2)} - ${q(fromRate, "ml/h", 2)}`),
        result(difference, "ml/h", 2),
      ],
      roundingNoteKey: "zaokrouhleniPumpa",
    };
  },

  answer: { unit: "mlPerHour", tolerance: tolerances.pumpRate(), decimals: 2 },
});
