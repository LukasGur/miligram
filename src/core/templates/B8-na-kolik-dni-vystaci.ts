import { dividedDose, doseVolume } from "../formulas";
import { dosingRule, dosingSource, presentationOf, type DosingRuleId } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

const RULES: readonly DosingRuleId[] = ["amoxicilin", "ibuprofenDeti"];

/**
 * B8 — na kolik dní balení vystačí.
 *
 * Praktická otázka z lékárny. Zaokrouhluje se dolů: neúplný den léčby
 * se nepočítá, protože pacient musí dobrat celou dávku.
 */
export const B8 = register({
  id: "B8",
  category: "hmotnost",
  source: [SUKL_DLP, ...RULES.map(dosingSource)],

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const range = rule.daily!;
    const presentation = presentationOf(ruleId);

    const perKgPerDay = difficulty === 1
      ? rng.pick([range.min, range.max])
      : rng.step(range.min, range.max, 5);
    const dosesPerDay = rng.pick(rule.dosesPerDay ?? [3]);
    const bottleMl = presentation.packVolumeMl;

    /**
     * Hmotnost se omezuje tak, aby lahvička vystačila aspoň na dva dny.
     * U těžkého dítěte a vysoké dávky vychází nula dní — situace reálná,
     * ale jako příklad je to chyták, ne výpočet.
     */
    const mlPerKgPerDay = (perKgPerDay / presentation.strengthMg) * presentation.referenceMl;
    const maxWeightKg = bottleMl / 2 / mlPerKgPerDay;
    const upper = Math.min(difficulty === 1 ? 25 : 35, Math.floor(maxWeightKg));
    const lower = Math.min(difficulty === 1 ? 10 : 5, upper);
    const weightKg = difficulty === 1 ? rng.step(lower, upper, 5) : rng.step(lower, upper, 0.5);

    return {
      ruleId,
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      strengthMg: presentation.strengthMg,
      referenceMl: presentation.referenceMl,
      bottleMl,
      weightKg,
      perKgPerDay,
      dosesPerDay,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const weightKg = Number(vars.weightKg);
    const perKgPerDay = Number(vars.perKgPerDay);
    const dosesPerDay = Number(vars.dosesPerDay);
    const strengthMg = Number(vars.strengthMg);
    const referenceMl = Number(vars.referenceMl);
    const bottleMl = Number(vars.bottleMl);

    const perDoseMg = dividedDose(perKgPerDay, weightKg, dosesPerDay);
    const perDoseMl = doseVolume(perDoseMg, strengthMg, referenceMl);
    const dailyMl = perDoseMl * dosesPerDay;
    const days = Math.floor(bottleMl / dailyMl + 1e-9);

    return {
      value: days,
      steps: [
        given(q(weightKg, "kg", 1), q(perKgPerDay, "mg/kg/den", 0), `${dosesPerDay}\\times\\text{ denně}`, q(bottleMl, "ml", 0)),
        intermediate("dilciDavka", {
          substituted: `m_{\\text{dávka}} = ${frac(`${q(perKgPerDay, "", 0)} \\times ${q(weightKg, "kg", 1)}`, String(dosesPerDay))}`,
          result: q(perDoseMg, "mg", 1),
        }),
        intermediate("objemNaDen", {
          substituted: `V_{\\text{den}} = ${frac(q(perDoseMg, "mg", 1), q(strengthMg, "mg", 0))} \\times ${q(referenceMl, "ml", 0)} \\times ${dosesPerDay}`,
          result: q(dailyMl, "ml", 2),
        }),
        formula(`n_{\\text{dní}} = \\left\\lfloor ${frac("V_{\\text{lahvička}}", "V_{\\text{den}}")} \\right\\rfloor`),
        substitute(`n_{\\text{dní}} = \\left\\lfloor ${frac(q(bottleMl, "ml", 0), q(dailyMl, "ml", 2))} \\right\\rfloor`),
        result(days, "dnů", 0),
      ],
      roundingNoteKey: "zaokrouhleniDolu",
    };
  },

  answer: { unit: "den", tolerance: tolerances.countable(), decimals: 0 },
});
