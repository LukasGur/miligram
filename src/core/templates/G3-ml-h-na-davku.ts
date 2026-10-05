import { mlPerHourToMicrogramsPerKgMin } from "../formulas";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";
import { choosePerfusorDilution, PER_KG_CODES, PER_KG_RULES, type PerKgRule } from "./perfusor";
import { dosingSource } from "../products/dosing";

/**
 * G3 — kolik pacient dostává.
 *
 * Pumpa běží zadanou rychlostí a ptáme se na dávku. Odpovídá předání
 * služby, kdy je potřeba přečíst z displeje, co se doopravdy podává.
 */
export const G3 = register({
  id: "G3",
  category: "vazoaktivni",
  source: [SUKL_DLP],
  // Dávkování podle látky, která v perfuzoru je.
  sourceFor: (vars) => [dosingSource(vars.ruleId as PerKgRule)],

  generate(rng, difficulty) {
    const ruleId = rng.pick(PER_KG_RULES);
    const weightKg = rng.step(50, 95, 5);
    const referenceDose = difficulty === 1 ? rng.pick([5, 10] as const) : rng.step(2, 20, 0.5);

    // Ředění se odvodí od referenční dávky, aby rychlost vyšla realisticky.
    const dilution = choosePerfusorDilution(rng, { perKgMin: referenceDose, weightKg }, { codes: PER_KG_CODES[ruleId] });
    const rateMlPerHour = Number(dilution.rateMlPerHour.toFixed(1));

    return {
      ruleId,
      code: dilution.product.code,
      productName: dilution.product.name,
      substance: dilution.product.substance,
      ampoules: dilution.ampoules,
      syringeMl: dilution.syringeMl,
      totalMg: dilution.totalMg,
      concentrationMgPerMl: dilution.concentrationMgPerMl,
      weightKg,
      rateMlPerHour,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const totalMg = Number(vars.totalMg);
    const syringeMl = Number(vars.syringeMl);
    const weightKg = Number(vars.weightKg);
    const rate = Number(vars.rateMlPerHour);

    const concentration = totalMg / syringeMl;
    const dose = mlPerHourToMicrogramsPerKgMin(rate, weightKg, concentration);

    return {
      value: dose,
      steps: [
        given(`${q(totalMg, "mg", 1)} / ${q(syringeMl, "ml", 0)}`, q(weightKg, "kg", 0), q(rate, "ml/h", 1)),
        intermediate("koncentrace", {
          substituted: `c = ${frac(q(totalMg, "mg", 1), q(syringeMl, "ml", 0))}`,
          result: q(concentration, "mg/ml", 4),
        }),
        formula(`D = ${frac("v \\times c \\times 1000", "m_{\\text{@body}} \\times 60")}`),
        substitute(
          `D = ${frac(
            `${q(rate, "ml/h", 1)} \\times ${q(concentration, "mg/ml", 4)} \\times ${q(1000, "\\mu g/mg", 0)}`,
            `${q(weightKg, "kg", 0)} \\times ${q(60, "min/h", 0)}`,
          )}`,
        ),
        result(dose, "\\mu g/kg/min", 2),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "ugPerKgMin", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
