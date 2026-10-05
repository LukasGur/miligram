import { bandFor, renalRule, renalSource } from "../products/renal";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";

const RULE = "karboplatina" as const;

/** Dávka při normální funkci ledvin, ke které se redukce vztahuje. */
const FULL_DOSE_MG_PER_M2 = 400;

const CLEARANCES = {
  1: [25, 45, 80] as const,
  2: [18, 32, 44, 52, 70] as const,
  3: [16, 27, 39, 41, 50, 59, 62, 100] as const,
};

/**
 * J5 — kolik procent plné dávky pacient dostane.
 *
 * Tatáž tabulka jako v J3, ale jinak položená otázka. V dokumentaci se
 * redukce zapisuje procenty („podáno 62,5 % dávky“), takže student musí
 * umět obojí: absolutní dávku i podíl z původní.
 */
export const J5 = register({
  id: "J5",
  category: "renalni",
  source: renalSource(RULE),

  generate(rng, difficulty) {
    return {
      crClMlPerMin: rng.pick(CLEARANCES[difficulty]),
      fullDose: FULL_DOSE_MG_PER_M2,
      product: packageLabel(renalRule(RULE).product),
    } satisfies Vars;
  },

  solve(vars): Solution {
    const crCl = Number(vars.crClMlPerMin);
    const band = bandFor(RULE, crCl);
    if (!band?.dose) throw new Error(`Clearance ${crCl} ml/min není v tabulce pravidla ${RULE}.`);

    const percent = (band.dose / FULL_DOSE_MG_PER_M2) * 100;

    return {
      value: percent,
      steps: [
        given(q(crCl, "ml/min", 0)),
        intermediate("pasmoZeSpc", { result: `${tex(band.dose, 0)}\\ \\mathrm{mg/m^2}` }),
        intermediate("plnaDavka", { result: `${tex(FULL_DOSE_MG_PER_M2, 0)}\\ \\mathrm{mg/m^2}` }),
        formula(`p = ${frac("d", "d_{100\\,\\%}")} \\times 100`),
        substitute(`p = ${frac(q(band.dose, "mg/m^2", 0), q(FULL_DOSE_MG_PER_M2, "mg/m^2", 0))} \\times 100`),
        result(percent, "\\%", 1),
      ],
      roundingNoteKey: "zaokrouhleniProcenta",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "percent", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance, 1) };
  },
});
