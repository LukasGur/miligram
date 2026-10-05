import { weightBasedDose } from "../formulas";
import { dosingRule, dosingSource } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, intermediate, orderStep, q, result, substitute } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";

/**
 * B6 — o kolik je nasycovací dávka vyšší než udržovací.
 *
 * Dva výpočty v jednom zadání. Otázka na rozdíl, ne na jednu z dávek,
 * nutí spočítat obě — a ukazuje, proč se nasycovací dávka podává jen jednou.
 */
export const B6 = register({
  id: "B6",
  category: "hmotnost",
  source: dosingSource("vankomycin"),

  generate(rng, difficulty) {
    const rule = dosingRule("vankomycin");
    const loading = rule.loading!;
    const maintenance = rule.single!;

    const weightKg = difficulty === 1 ? rng.step(60, 90, 10) : rng.step(45, 110, 1);
    const loadingPerKg = difficulty === 1
      ? rng.pick([loading.min, loading.max])
      : rng.step(loading.min, loading.max, orderStep(loading));
    const maintenancePerKg = difficulty === 1
      ? rng.pick([maintenance.min, maintenance.max])
      : rng.step(maintenance.min, maintenance.max, orderStep(maintenance));

    return {
      productName: packageLabel(rule.product),
      substance: rule.substance,
      code: rule.suklCode,
      loadingPerKg,
      maintenancePerKg,
      weightKg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const weightKg = Number(vars.weightKg);
    const loadingPerKg = Number(vars.loadingPerKg);
    const maintenancePerKg = Number(vars.maintenancePerKg);

    const loadingMg = weightBasedDose(loadingPerKg, weightKg);
    const maintenanceMg = weightBasedDose(maintenancePerKg, weightKg);
    const differenceMg = loadingMg - maintenanceMg;

    return {
      value: differenceMg,
      steps: [
        given(q(weightKg, "kg", 0), `${q(loadingPerKg, "mg/kg", 1)}\\text{ @loadingShort}`, `${q(maintenancePerKg, "mg/kg", 1)}\\text{ @maintenanceShort}`),
        intermediate("nasycovaciDavka", {
          substituted: `m_{\\text{@loadingShort}} = ${q(loadingPerKg, "mg/kg", 1)} \\times ${q(weightKg, "kg", 0)}`,
          result: q(loadingMg, "mg", 1),
        }),
        intermediate("udrzovaciDavka", {
          substituted: `m_{\\text{@maintenanceShort}} = ${q(maintenancePerKg, "mg/kg", 1)} \\times ${q(weightKg, "kg", 0)}`,
          result: q(maintenanceMg, "mg", 1),
        }),
        formula(`\\Delta m = m_{\\text{@loadingShort}} - m_{\\text{@maintenanceShort}}`),
        substitute(`\\Delta m = ${q(loadingMg, "mg", 1)} - ${q(maintenanceMg, "mg", 1)}`),
        result(differenceMg, "mg", 1),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mg", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
