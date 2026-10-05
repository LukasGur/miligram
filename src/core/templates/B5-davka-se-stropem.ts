import { weightBasedDose } from "../formulas";
import { dosingRule, dosingSource } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, intermediate, orderStep, q, result, substitute } from "./helpers";
import { register } from "./registry";

/**
 * B5 — dávka podle hmotnosti se stropem na jedno podání.
 *
 * U těžších pacientů se výpočet nepoužije: SPC vankomycinu má tvrdý limit
 * 2 g na dávku. Kdo strop přehlédne, podá u stokilového pacienta o polovinu
 * víc — proto se hmotnost losuje tak, aby limit občas skutečně zabral.
 */
export const B5 = register({
  id: "B5",
  category: "hmotnost",
  source: dosingSource("vankomycin"),

  generate(rng, difficulty) {
    const rule = dosingRule("vankomycin");
    const range = rule.single!;

    // Nad zhruba 100 kg se při 20 mg/kg strop 2000 mg uplatní.
    const weightKg = difficulty === 1
      ? rng.step(60, 90, 5)
      : rng.step(55, 140, 5);
    const perKg = difficulty === 1 ? rng.pick([15, 20] as const) : rng.step(range.min, range.max, orderStep(range));

    return {
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      rangeMin: range.min,
      rangeMax: range.max,
      maxSingleMg: rule.maxSingleMg ?? 2000,
      perKg,
      weightKg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const perKg = Number(vars.perKg);
    const weightKg = Number(vars.weightKg);
    const maxSingleMg = Number(vars.maxSingleMg);

    const computedMg = weightBasedDose(perKg, weightKg);
    const doseMg = Math.min(computedMg, maxSingleMg);
    const capped = doseMg < computedMg;

    return {
      value: doseMg,
      steps: [
        given(q(weightKg, "kg", 0), q(perKg, "mg/kg", 1), `\\max ${q(maxSingleMg, "mg", 0)}`),
        formula(`m = D_{\\text{kg}} \\times m_{\\text{@body}}`),
        substitute(`m = ${q(perKg, "mg/kg", 1)} \\times ${q(weightKg, "kg", 0)}`, q(computedMg, "mg", 1)),
        intermediate(capped ? "stropSeUplatnil" : "stropSeNeuplatnil", {
          substituted: `\\min(${q(computedMg, "mg", 1)},\\; ${q(maxSingleMg, "mg", 0)})`,
          result: q(doseMg, "mg", 1),
        }),
        result(doseMg, "mg", 1),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mg", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
