import { bodySurfaceArea, bsaBasedDose, doseVolume } from "../formulas";
import { syringeFor } from "../devices";
import { dosingRule, dosingSource, liquidPresentationOf, type DosingRuleId } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { ISO_7886, register, SUKL_DLP } from "./registry";

const RULES: readonly DosingRuleId[] = ["paklitaxel", "karboplatina"];

/**
 * C3 — od výšky a hmotnosti k objemu koncentrátu.
 *
 * Tři kroky za sebou: povrch, dávka, objem. Chyba v prvním se propíše
 * do všech dalších, proto řešení ukazuje každý mezivýsledek zvlášť.
 */
export const C3 = register({
  id: "C3",
  category: "povrch",
  source: [SUKL_DLP, ISO_7886, ...RULES.map(dosingSource)],

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const range = rule.single!;
    const presentation = liquidPresentationOf(ruleId);

    const heightCm = difficulty === 1 ? rng.step(160, 190, 10) : rng.step(145, 195, 1);
    const weightKg = difficulty === 1 ? rng.step(60, 90, 10) : rng.step(45, 110, 1);
    const perM2 = difficulty === 1 ? range.max : rng.step(range.min, range.max, 5);

    return {
      ruleId,
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      concentrationMgPerMl: presentation.strengthMg / presentation.referenceMl,
      vialMl: presentation.packVolumeMl,
      perM2,
      heightCm,
      weightKg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const heightCm = Number(vars.heightCm);
    const weightKg = Number(vars.weightKg);
    const perM2 = Number(vars.perM2);
    const concentration = Number(vars.concentrationMgPerMl);

    const bsa = bodySurfaceArea(heightCm, weightKg);
    const doseMg = bsaBasedDose(perM2, bsa);
    const volumeMl = doseVolume(doseMg, concentration, 1);

    return {
      value: volumeMl,
      steps: [
        given(q(heightCm, "cm", 0), q(weightKg, "kg", 0), q(perM2, "mg/m^2", 0), q(concentration, "mg/ml", 1)),
        intermediate("povrchTela", {
          formula: `BSA = \\sqrt{${frac("v \\times m", "3600")}}`,
          substituted: `BSA = \\sqrt{${frac(`${q(heightCm, "", 0)} \\times ${q(weightKg, "", 0)}`, "3600")}}`,
          result: q(bsa, "m^2", 2),
        }),
        intermediate("celkovaDavka", {
          substituted: `m = ${q(perM2, "", 0)} \\times ${q(bsa, "m^2", 2)}`,
          result: q(doseMg, "mg", 1),
        }),
        formula(`V = ${frac("m", "c")}`),
        substitute(`V = ${frac(q(doseMg, "mg", 1), q(concentration, "mg/ml", 1))}`),
        result(volumeMl, "ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(Math.min(solution.value, 50)),
      decimals: (syringeFor(Math.min(solution.value, 50)) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
