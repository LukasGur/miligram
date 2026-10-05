import { calvertDose, creatinineClearance } from "../formulas";
import {
  AUC_TARGETS,
  CALVERT_PAPER,
  CALVERT_SPC,
  CARBOPLATIN_MG_PER_ML,
  CARBOPLATIN_SUKL_CODE,
} from "../products/oncology";
import { COCKCROFT_GAULT_SPC_SOURCE } from "../products/renal";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { ISO_7886, register } from "./registry";

/** Nejvyšší GFR, se kterým se v praxi dosazuje do Calvertova vzorce. */
const MAX_GFR_ML_PER_MIN = 125;

/**
 * L2 — od Calverta k objemu koncentrátu.
 *
 * Na třetí úrovni začíná příklad u kreatininu: nejdřív clearance, pak
 * dávka, pak objem. GFR se v Calvertově vzorci odhaduje právě
 * z Cockcroft–Gaultovy clearance — SPC vankomycinu tentýž vzorec pro
 * odhad glomerulární filtrace uvádí, takže se ta záměna neděje potichu.
 */
export const L2 = register({
  id: "L2",
  category: "onkologie",
  source: [CALVERT_PAPER, CALVERT_SPC, COCKCROFT_GAULT_SPC_SOURCE, ISO_7886],

  generate(rng, difficulty) {
    const target = rng.pick(AUC_TARGETS);
    const fromCreatinine = difficulty === 3;

    const female = rng.int(0, 1);
    const ageYears = rng.step(38, 76, 1);
    const weightKg = rng.step(52, 96, 1);
    let creatinineUmolPerL = rng.step(65, 135, 5);

    /**
     * Mladý těžší pacient s nízkým kreatininem by měl clearance kolem
     * 150 ml/min a karboplatinu přes 1,2 g. SPC strop GFR neuvádí, praxe
     * dosazuje nejvýš 125 ml/min; zadání se proto do té oblasti nedostane.
     */
    const clearance = () => creatinineClearance({ ageYears, weightKg, creatinineUmolPerL, female: female === 1 });
    while (fromCreatinine && clearance() > MAX_GFR_ML_PER_MIN) creatinineUmolPerL += 5;

    const gfrMlPerMin = fromCreatinine
      ? clearance()
      : difficulty === 1
        ? rng.step(60, 100, 10)
        : rng.step(45, 110, 5);

    return {
      code: CARBOPLATIN_SUKL_CODE,
      auc: target.auc,
      regimen: target.regimen,
      concentration: CARBOPLATIN_MG_PER_ML,
      fromCreatinine: fromCreatinine ? 1 : 0,
      female,
      ageYears,
      weightKg,
      creatinineUmolPerL,
      gfrMlPerMin,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const auc = Number(vars.auc);
    const gfr = Number(vars.gfrMlPerMin);
    const concentration = Number(vars.concentration);
    const doseMg = calvertDose(auc, gfr);
    const volumeMl = doseMg / concentration;

    const steps = [];
    if (Number(vars.fromCreatinine) === 1) {
      steps.push(
        given(
          `${tex(Number(vars.ageYears), 0)}\\ \\text{@years}`,
          q(Number(vars.weightKg), "kg", 0),
          `${tex(Number(vars.creatinineUmolPerL), 0)}\\ \\mathrm{\\mu mol/l}`,
        ),
        intermediate("clearance", { result: q(gfr, "ml/min", 1) }),
      );
    } else {
      steps.push(given(`AUC = ${tex(auc, 0)}\\ \\mathrm{mg/ml\\cdot min}`, q(gfr, "ml/min", 0)));
    }

    steps.push(
      formula("D = AUC \\times (GFR + 25)"),
      substitute(`D = ${q(auc, "mg/ml\\cdot min", 0)} \\times (${q(gfr, "ml/min", 1)} + ${q(25, "ml/min", 0)})`, q(doseMg, "mg", 1)),
      formula(`V = ${frac("D", "c")}`),
      substitute(`V = ${frac(q(doseMg, "mg", 1), q(concentration, "mg/ml", 0))}`),
      result(volumeMl, "ml", 1),
    );

    return { value: volumeMl, steps, roundingNoteKey: "zaokrouhleniStrikacka" };
  },

  answer(_vars, solution) {
    const capped = Math.min(solution.value, 50);
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(capped),
      decimals: (syringeFor(capped) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
