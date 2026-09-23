import { creatinineClearance } from "../formulas";
import { bandFor, COCKCROFT_GAULT_SPC_SOURCE, renalSource } from "../products/renal";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

const RULE = "vankomycinDospeli" as const;

/**
 * J2 — denní dávka vankomycinu podle funkce ledvin.
 *
 * Dvoukrokový příklad: nejdřív clearance, pak tabulka z SPC. Podstatné je,
 * že se nemění velikost jednotlivé dávky — ta zůstává 15 mg/kg — ale
 * počet podání za den. Denní dávka tím klesne na polovinu, aniž by se
 * kdekoli objevilo číslo „poloviční dávka“.
 */
export const J2 = register({
  id: "J2",
  category: "renalni",
  source: [renalSource(RULE), COCKCROFT_GAULT_SPC_SOURCE],

  generate(rng, difficulty) {
    const female = rng.int(0, 1);
    const ageYears = difficulty === 1 ? rng.step(40, 80, 10) : rng.step(35, 88, 1);
    const weightKg = difficulty === 1 ? rng.step(60, 90, 10) : rng.step(48, 105, 1);

    // Kreatinin se losuje jako laboratorní hodnota a clearance z něj plyne;
    // opačný postup by dal fyziologicky nemožné kombinace věku a kreatininu.
    let creatinineUmolPerL = difficulty === 1 ? rng.step(90, 240, 30) : rng.step(75, 265, 5);
    let crCl = creatinineClearance({ ageYears, weightKg, creatinineUmolPerL, female: female === 1 });

    // Pod 20 ml/min už SPC dávkování neurčuje a zadání by nemělo řešení.
    for (let guard = 0; crCl < 22 && creatinineUmolPerL > 60 && guard < 50; guard += 1) {
      creatinineUmolPerL -= 5;
      crCl = creatinineClearance({ ageYears, weightKg, creatinineUmolPerL, female: female === 1 });
    }

    return { female, ageYears, weightKg, creatinineUmolPerL } satisfies Vars;
  },

  solve(vars): Solution {
    const female = Number(vars.female) === 1;
    const ageYears = Number(vars.ageYears);
    const weightKg = Number(vars.weightKg);
    const creatinineUmolPerL = Number(vars.creatinineUmolPerL);

    const crCl = creatinineClearance({ ageYears, weightKg, creatinineUmolPerL, female });
    /**
     * Pásma v SPC jsou zapsaná celými čísly („20 až 49 ml/min“), takže
     * se v nich odečítá zaokrouhlená clearance. Bez toho by hodnota
     * 49,1 ml/min spadla mezi dvě pásma a zadání by nemělo řešení.
     */
    const band = bandFor(RULE, Math.round(crCl));
    if (!band?.dose || !band.intervalHours) {
      throw new Error(`Clearance ${crCl} ml/min není v tabulce pravidla ${RULE}.`);
    }

    const singleMg = band.dose * weightKg;
    const dosesPerDay = 24 / band.intervalHours;
    const dailyMg = singleMg * dosesPerDay;

    return {
      value: dailyMg,
      steps: [
        given(`${tex(ageYears, 0)}\\ \\text{@years}`, q(weightKg, "kg", 0), `${tex(creatinineUmolPerL, 0)}\\ \\mathrm{\\mu mol/l}`),
        intermediate("clearance", {
          formula: `CrCl = ${frac("(140 - \\text{@age}) \\times m", "72 \\times S_{kr}")}${female ? " \\times 0{,}85" : ""}`,
          result: q(crCl, "ml/min", 1),
        }),
        intermediate("pasmoZeSpc", {
          result: `${tex(band.dose, 0)}\\ \\mathrm{mg/kg}\\ \\text{@every}\\ ${tex(band.intervalHours, 0)}\\ \\mathrm{h}`,
        }),
        substitute(`${q(band.dose, "mg/kg", 0)} \\times ${q(weightKg, "kg", 0)}`, q(singleMg, "mg", 0)),
        formula("D_{24} = d \\times \\text{@doseCount}"),
        substitute(`${q(singleMg, "mg", 0)} \\times ${tex(dosesPerDay, 0)}`, q(dailyMg, "mg", 0)),
        result(dailyMg, "mg", 0),
      ],
      roundingNoteKey: "zaokrouhleniDavka",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mg", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance, 1) };
  },
});
