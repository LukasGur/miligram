import { bodySurfaceArea, bsaBasedDose } from "../formulas";
import { bandFor, renalRule, renalSource } from "../products/renal";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

const RULE = "karboplatina" as const;

/** Clearance uvnitř pásem z SPC — hranice se nelosují, tam tabulka mlčí. */
const CLEARANCES = {
  1: [30, 50, 80] as const,
  2: [22, 35, 45, 55, 70, 95] as const,
  3: [17, 26, 38, 42, 48, 58, 63, 88, 115] as const,
};

/**
 * J3 — dávka karboplatiny podle funkce ledvin.
 *
 * Tady se dávka opravdu snižuje, na rozdíl od vankomycinu, kde se
 * prodlužuje interval. Obě strategie mají svůj důvod a pletou se —
 * proto jsou v aplikaci obě a obě z citovaného SPC.
 */
export const J3 = register({
  id: "J3",
  category: "renalni",
  source: renalSource(RULE),

  generate(rng, difficulty) {
    const heightCm = difficulty === 1 ? rng.step(160, 185, 5) : rng.step(150, 192, 1);
    const weightKg = difficulty === 1 ? rng.step(60, 90, 10) : rng.step(48, 105, 1);

    return {
      heightCm,
      weightKg,
      crClMlPerMin: rng.pick(CLEARANCES[difficulty]),
      product: renalRule(RULE).product,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const heightCm = Number(vars.heightCm);
    const weightKg = Number(vars.weightKg);
    const crCl = Number(vars.crClMlPerMin);

    const band = bandFor(RULE, crCl);
    if (!band?.dose) throw new Error(`Clearance ${crCl} ml/min není v tabulce pravidla ${RULE}.`);

    const bsa = bodySurfaceArea(heightCm, weightKg);
    const doseMg = bsaBasedDose(band.dose, bsa);

    return {
      value: doseMg,
      steps: [
        given(q(heightCm, "cm", 0), q(weightKg, "kg", 0), q(crCl, "ml/min", 0)),
        intermediate("povrchTela", { result: q(bsa, "m^2", 2) }),
        intermediate("pasmoZeSpc", { result: `${tex(band.dose, 0)}\\ \\mathrm{mg/m^2}` }),
        formula("D = d_{m^2} \\times BSA"),
        substitute(`${q(band.dose, "mg/m^2", 0)} \\times ${q(bsa, "m^2", 2)}`, q(doseMg, "mg", 1)),
        result(doseMg, "mg", 1),
      ],
      roundingNoteKey: "zaokrouhleniDavka",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mg", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance, 1) };
  },
});
