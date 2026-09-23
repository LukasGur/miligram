import * as tolerances from "../tolerances";
import type { Solution } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { register } from "./registry";

/**
 * G7 — dva způsoby zápisu téže dávky.
 *
 * Noradrenalin se ordinuje v µg/min, dobutamin v µg/kg/min. Když se
 * v dokumentaci potkají, je potřeba je umět porovnat — jinak vypadá
 * osminásobný rozdíl jako totéž.
 */
export const G7 = register({
  id: "G7",
  category: "vazoaktivni",
  source: {
    citation:
      "Vztah mezi zápisem dávky na minutu a na kilogram a minutu: " +
      "D[µg/min] = D[µg/kg/min] × tělesná hmotnost[kg].",
    verifiedAt: "2026-09-03",
  },

  generate(rng, difficulty) {
    const weightKg = difficulty === 1 ? rng.step(60, 90, 10) : rng.step(45, 110, 1);
    const direction = difficulty === 1
      ? "perKgToTotal"
      : rng.pick(["perKgToTotal", "totalToPerKg"] as const);

    return direction === "perKgToTotal"
      ? { direction, weightKg, dosePerKgMin: rng.step(0.5, 15, 0.5), dosePerMin: 0 }
      : { direction, weightKg, dosePerKgMin: 0, dosePerMin: rng.step(2, 60, 1) };
  },

  solve(vars): Solution {
    const weightKg = Number(vars.weightKg);

    if (vars.direction === "perKgToTotal") {
      const perKg = Number(vars.dosePerKgMin);
      const total = perKg * weightKg;
      return {
        value: total,
        steps: [
          given(q(perKg, "\\mu g/kg/min", 2), q(weightKg, "kg", 0)),
          formula(`D_{\\text{min}} = D_{\\text{kg,min}} \\times m_{\\text{@body}}`),
          substitute(`D_{\\text{min}} = ${q(perKg, "\\mu g/kg/min", 2)} \\times ${q(weightKg, "kg", 0)}`),
          result(total, "\\mu g/min", 2),
        ],
        roundingNoteKey: "zaokrouhleniMezivysledek",
      };
    }

    const total = Number(vars.dosePerMin);
    const perKg = total / weightKg;
    return {
      value: perKg,
      steps: [
        given(q(total, "\\mu g/min", 1), q(weightKg, "kg", 0)),
        formula(`D_{\\text{kg,min}} = ${frac("D_{\\text{min}}", "m_{\\text{@body}}")}`),
        substitute(`D_{\\text{kg,min}} = ${frac(q(total, "\\mu g/min", 1), q(weightKg, "kg", 0))}`),
        result(perKg, "\\mu g/kg/min", 3),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(vars, solution) {
    const tolerance = tolerances.intermediate();
    return {
      unit: vars.direction === "perKgToTotal" ? "ugPerMin" : "ugPerKgMin",
      tolerance,
      decimals: tolerances.decimalsFor(solution.value, tolerance),
    };
  },
});
