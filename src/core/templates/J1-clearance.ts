import { creatinineClearance, CREATININE_MGDL_PER_UMOLL } from "../formulas";
import { COCKCROFT_GAULT_SPC_SOURCE } from "../products/renal";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

const COCKCROFT_GAULT = {
  citation:
    "Cockcroft DW, Gault MH. Prediction of creatinine clearance from serum creatinine. " +
    "Nephron 1976;16(1):31–41.",
  verifiedAt: "2026-09-02",
};

/**
 * J1 — clearance kreatininu podle Cockcrofta a Gaulta.
 *
 * České laboratoře hlásí kreatinin v µmol/l, původní vzorec počítá
 * s mg/dl. Převod je součástí výpočtu, ne něco, co se dá přeskočit —
 * konstanty 1,23 a 1,04, které se často opisují jako „SI verze“, jsou
 * jen důsledek tohohle dělení.
 */
export const J1 = register({
  id: "J1",
  category: "renalni",
  source: [COCKCROFT_GAULT, COCKCROFT_GAULT_SPC_SOURCE],

  generate(rng, difficulty) {
    const female = rng.int(0, 1);
    const ageYears = difficulty === 1 ? rng.step(30, 70, 10) : rng.step(22, 88, 1);
    const weightKg = difficulty === 1 ? rng.step(60, 90, 10) : rng.step(45, 110, 1);
    const creatinineUmolPerL = difficulty === 1
      ? rng.step(80, 120, 10)
      : difficulty === 2
        ? rng.step(70, 220, 5)
        : rng.step(62, 340, 1);

    return { female, ageYears, weightKg, creatinineUmolPerL } satisfies Vars;
  },

  solve(vars): Solution {
    const female = Number(vars.female) === 1;
    const ageYears = Number(vars.ageYears);
    const weightKg = Number(vars.weightKg);
    const creatinineUmolPerL = Number(vars.creatinineUmolPerL);

    const creatinineMgPerDl = creatinineUmolPerL * CREATININE_MGDL_PER_UMOLL;
    const crCl = creatinineClearance({ ageYears, weightKg, creatinineUmolPerL, female });
    const crClBeforeCorrection = creatinineClearance({ ageYears, weightKg, creatinineUmolPerL, female: false });

    const steps = [
      given(`${tex(ageYears, 0)}\\ \\text{@years}`, q(weightKg, "kg", 0), `${tex(creatinineUmolPerL, 0)}\\ \\mathrm{\\mu mol/l}`),
      intermediate("prevodKreatininu", {
        formula: `1\\ \\mathrm{mg/dl} = 88{,}4\\ \\mathrm{\\mu mol/l}`,
        substituted: `${frac(tex(creatinineUmolPerL, 0), "88{,}4")}`,
        result: `${tex(creatinineMgPerDl, 3)}\\ \\mathrm{mg/dl}`,
      }),
      formula(`CrCl = ${frac("(140 - \\text{@age}) \\times m", "72 \\times S_{kr}")}`),
      substitute(
        `CrCl = ${frac(`(140 - ${tex(ageYears, 0)}) \\times ${tex(weightKg, 0)}`, `72 \\times ${tex(creatinineMgPerDl, 3)}`)}`,
        q(crClBeforeCorrection, "ml/min", 1),
      ),
    ];

    if (female) {
      steps.push(
        intermediate("korekceZeny", {
          substituted: `CrCl = ${q(crClBeforeCorrection, "ml/min", 1)} \\times 0{,}85`,
          result: q(crCl, "ml/min", 1),
        }),
      );
    }
    steps.push(result(crCl, "ml/min", 1));

    return { value: crCl, steps, roundingNoteKey: "zaokrouhleniClearance" };
  },

  answer: { unit: "mlPerMin", tolerance: tolerances.clearance(), decimals: 1 },
});
