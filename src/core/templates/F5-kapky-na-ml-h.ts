import { DROP_FACTORS, DROP_FACTOR_SOURCE, PUMP_SOURCE } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { register } from "./registry";

/**
 * F5 — z kapek zpět na ml/h.
 *
 * Sestra hlásí, kolik kape, pumpa se nastavuje v ml/h. Převod je stejný
 * vztah jako u F2, jen řešený pro jinou neznámou — a právě proto se
 * hodí ho procvičit zvlášť.
 */
export const F5 = register({
  id: "F5",
  category: "infuze",
  source: [DROP_FACTOR_SOURCE, PUMP_SOURCE],

  generate(rng, difficulty) {
    const dropFactor = difficulty === 1 ? rng.pick([20, 60] as const) : rng.pick(DROP_FACTORS);
    const dropsPerMin = difficulty === 1
      ? rng.pick([20, 30, 40, 60] as const)
      : rng.int(8, 90);

    return { dropFactor, dropsPerMin } satisfies Vars;
  },

  solve(vars): Solution {
    const dropFactor = Number(vars.dropFactor);
    const dropsPerMin = Number(vars.dropsPerMin);
    // gtt/min = V × f / t  ⇒  ml/h = gtt/min × 60 / f
    const rate = (dropsPerMin * 60) / dropFactor;

    return {
      value: rate,
      steps: [
        given(q(dropsPerMin, "gtt/min", 0), `${dropFactor}${" "}\\mathrm{gtt/ml}`),
        formula(`v = ${frac("\\text{gtt/min} \\times 60", "\\text{kapkový faktor}")}`),
        substitute(`v = ${frac(`${q(dropsPerMin, "", 0)} \\times 60`, String(dropFactor))}`),
        result(rate, "ml/h", 1),
      ],
      roundingNoteKey: "zaokrouhleniPumpa",
    };
  },

  answer: { unit: "mlPerHour", tolerance: tolerances.pumpRate(), decimals: 1 },
});
