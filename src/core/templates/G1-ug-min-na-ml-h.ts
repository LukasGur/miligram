import { microgramsPerMinToMlPerHour } from "../formulas";
import { PUMP_SOURCE } from "../devices";
import { dosingRule, dosingSource } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";
import { choosePerfusorDilution } from "./perfusor";

/**
 * G1 — µg/min na ml/h.
 *
 * Noradrenalin se u dospělých dávkuje bez přepočtu na hmotnost, takže
 * ve vzorci chybí kilogramy — a právě to je nástraha, když si někdo
 * zapamatuje postup od dobutaminu.
 */
export const G1 = register({
  id: "G1",
  category: "vazoaktivni",
  source: [SUKL_DLP, PUMP_SOURCE, dosingSource("noradrenalin")],

  generate(rng, difficulty) {
    const rule = dosingRule("noradrenalin");
    const range = rule.single!;

    const dosePerMin = difficulty === 1
      ? rng.pick([range.min, 5, range.max])
      : rng.step(range.min, range.max, 0.5);

    const dilution = choosePerfusorDilution(rng, { perMin: dosePerMin });

    return {
      code: dilution.product.code,
      productName: dilution.product.name,
      substance: dilution.product.substance,
      ampoules: dilution.ampoules,
      syringeMl: dilution.syringeMl,
      totalMg: dilution.totalMg,
      concentrationMgPerMl: dilution.concentrationMgPerMl,
      dosePerMin,
      rangeMin: range.min,
      rangeMax: range.max,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const totalMg = Number(vars.totalMg);
    const syringeMl = Number(vars.syringeMl);
    const dose = Number(vars.dosePerMin);
    const concentration = totalMg / syringeMl;
    const rate = microgramsPerMinToMlPerHour(dose, concentration);

    return {
      value: rate,
      steps: [
        given(`${q(totalMg, "mg", 2)} / ${q(syringeMl, "ml", 0)}`, q(dose, "\\mu g/min", 2)),
        intermediate("koncentrace", {
          formula: `c = ${frac("m", "V")}`,
          substituted: `c = ${frac(q(totalMg, "mg", 2), q(syringeMl, "ml", 0))}`,
          result: q(concentration, "mg/ml", 4),
        }),
        formula(`\\text{ml/h} = ${frac("D \\times 60", "c \\times 1000")}`),
        substitute(`\\text{ml/h} = ${frac(`${q(dose, "", 2)} \\times 60`, `${q(concentration, "", 4)} \\times 1000`)}`),
        result(rate, "ml/h", 2),
      ],
      roundingNoteKey: "zaokrouhleniPumpa",
    };
  },

  answer: { unit: "mlPerHour", tolerance: tolerances.pumpRate(), decimals: 2 },
});
