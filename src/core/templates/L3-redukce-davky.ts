import { bodySurfaceArea, bsaBasedDose } from "../formulas";
import { dosingRule, dosingSource, type DosingRuleId } from "../products/dosing";
import { DOSE_REDUCTION_PERCENT, DOSE_REDUCTION_SPC } from "../products/oncology";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

/** Cytostatika, u kterých SPC uvádí dávku na metr čtvereční. */
const RULES: readonly DosingRuleId[] = ["paklitaxel", "karboplatina", "doxorubicin"];

/**
 * L3 — snížená dávka po toxicitě předchozího cyklu.
 *
 * Podíl, o který se dávka snižuje, není vlastnost léku: rozhoduje o něm
 * lékař podle stavu pacienta a v zadání je proto uvedený. Ze zdroje
 * pochází jen rozsah, ve kterém se pohybuje — SPC karboplatiny mluví
 * o snížení o 20–25 % u rizikových pacientů — a dávka na metr čtvereční,
 * ze které se vychází.
 */
export const L3 = register({
  id: "L3",
  category: "onkologie",
  source: [...RULES.map((id) => dosingSource(id)), DOSE_REDUCTION_SPC],

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const range = rule.single;
    if (!range || range.unit !== "mg/m2") {
      throw new Error(`Pravidlo ${ruleId} nemá dávku v mg/m².`);
    }

    const heightCm = difficulty === 1 ? rng.step(160, 185, 5) : rng.step(150, 192, 1);
    const weightKg = difficulty === 1 ? rng.step(60, 90, 10) : rng.step(48, 105, 1);
    const fullDosePerM2 = difficulty === 1 ? range.min : rng.step(range.min, range.max, 5);
    const reductionPercent = difficulty === 1
      ? DOSE_REDUCTION_PERCENT.min
      : rng.step(DOSE_REDUCTION_PERCENT.min, DOSE_REDUCTION_PERCENT.max, 5);

    return {
      ruleId,
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      heightCm,
      weightKg,
      fullDosePerM2,
      reductionPercent,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const heightCm = Number(vars.heightCm);
    const weightKg = Number(vars.weightKg);
    const fullDosePerM2 = Number(vars.fullDosePerM2);
    const reductionPercent = Number(vars.reductionPercent);

    const bsa = bodySurfaceArea(heightCm, weightKg);
    const fullDoseMg = bsaBasedDose(fullDosePerM2, bsa);
    const share = (100 - reductionPercent) / 100;
    const reducedMg = fullDoseMg * share;

    return {
      value: reducedMg,
      steps: [
        given(q(heightCm, "cm", 0), q(weightKg, "kg", 0), `${tex(fullDosePerM2, 0)}\\ \\mathrm{mg/m^2}`, `-${tex(reductionPercent, 0)}\\,\\%`),
        intermediate("povrchTela", { result: q(bsa, "m^2", 2) }),
        intermediate("plnaDavka", {
          substituted: `${tex(fullDosePerM2, 0)} \\times ${tex(bsa, 2)}`,
          result: q(fullDoseMg, "mg", 1),
        }),
        formula(`D_{sn} = D \\times ${frac("100 - p", "100")}`),
        substitute(`D_{sn} = ${tex(fullDoseMg, 1)} \\times ${frac(`100 - ${tex(reductionPercent, 0)}`, "100")}`),
        result(reducedMg, "mg", 1),
      ],
      roundingNoteKey: "zaokrouhleniDavka",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mg", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance, 1) };
  },
});
