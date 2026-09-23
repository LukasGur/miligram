import { bandFor, renalRule, renalSource } from "../products/renal";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { given, intermediate, q, result, step, tex } from "./helpers";
import { register } from "./registry";

const RULE = "vankomycinDeti" as const;

/** Hodnoty eGFR uvnitř pásem tabulky z SPC. */
const EGFR = {
  1: [45, 20] as const,
  2: [48, 38, 32, 26, 18, 12] as const,
  3: [50, 41, 36, 31, 30, 29, 24, 15, 11, 10] as const,
};

/**
 * J4 — jak často podat, když ledviny nestačí.
 *
 * Druhá strategie u renální insuficience: dávka zůstane, prodlouží se
 * interval. SPC vankomycinu ji u dětí uvádí tabulkou, takže odpověď není
 * odhad, ale odečet. Zadání proto losuje jen hodnoty uvnitř pásem —
 * na hranici by tabulka mlčela.
 */
export const J4 = register({
  id: "J4",
  category: "renalni",
  source: renalSource(RULE),

  generate(rng, difficulty) {
    return {
      egfr: rng.pick(EGFR[difficulty]),
      weightKg: difficulty === 1 ? rng.step(15, 35, 5) : rng.step(8, 42, 1),
      product: renalRule(RULE).product,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const egfr = Number(vars.egfr);
    const weightKg = Number(vars.weightKg);

    const band = bandFor(RULE, egfr);
    if (!band?.dose || !band.intervalHours) {
      throw new Error(`eGFR ${egfr} ml/min/1,73 m² není v tabulce pravidla ${RULE}.`);
    }
    const singleMg = band.dose * weightKg;

    return {
      value: band.intervalHours,
      steps: [
        given(`${tex(egfr, 0)}\\ \\mathrm{ml/min/1{,}73\\ m^2}`, `${tex(weightKg, 0)}\\,\\mathrm{kg}`),
        step("odectVTabulce", { result: `${tex(band.dose, 0)}\\ \\mathrm{mg/kg}` }),
        intermediate("davkaNaPodani", {
          substituted: `${q(band.dose, "mg/kg", 0)} \\times ${q(weightKg, "kg", 0)}`,
          result: `${tex(singleMg, 0)}\\,\\mathrm{mg}`,
        }),
        result(band.intervalHours, "h", 0),
      ],
      roundingNoteKey: "zaokrouhleniInterval",
    };
  },

  answer: { unit: "h", tolerance: tolerances.countable(), decimals: 0 },
});
