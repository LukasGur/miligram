import { doseVolume, weightBasedDose } from "../formulas";
import { syringeFor } from "../devices";
import { PRODUCTS } from "../products";
import { dosingRule, dosingSource } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { ISO_7886, register, SUKL_DLP } from "./registry";

/**
 * B4 — enoxaparin: z IU/kg na objem.
 *
 * Přípravek je značený v obou jednotkách zároveň (6 000 IU (60 mg)/0,6 ml),
 * takže se dá počítat oběma cestami. Šablona vede přes miligramy, protože
 * tak je uvedená síla i na stříkačce.
 */
export const B4 = register({
  id: "B4",
  category: "hmotnost",
  source: [SUKL_DLP, ISO_7886, dosingSource("enoxaparin")],

  generate(rng, difficulty) {
    const rule = dosingRule("enoxaparin");

    /**
     * Předplněné stříkačky enoxaparinu z fondu. Vícedávkové lahvičky
     * (3, 5 a 10 ml) sem nepatří — příklad se ptá na stříkačku, kterou
     * sestra vezme z lednice, a ta má nejvýš 1 ml.
     */
    const syringes = PRODUCTS
      .filter((p) =>
        p.substance === "ENOXAPARIN" &&
        p.kind === "ampoule" &&
        p.volumeMl !== undefined &&
        p.volumeMl <= 1,
      )
      .sort((a, b) => a.strength - b.strength);
    if (syringes.length === 0) throw new Error("Ve fondu nejsou předplněné stříkačky enoxaparinu.");

    const perKg = difficulty === 1 ? 1 : rng.pick([1, 1.5] as const);

    /**
     * Hmotnost se omezuje tak, aby se dávka vešla do nejsilnější předplněné
     * stříkačky. Nad ní se v praxi podávají dvě injekce nebo vícedávková
     * lahvička — jiná úloha, která do téhle šablony nepatří.
     */
    const strongestMg = syringes[syringes.length - 1].strength;
    const maxWeightKg = Math.floor(strongestMg / perKg);
    const weightKg = difficulty === 1
      ? rng.step(50, Math.min(90, maxWeightKg), 10)
      : rng.step(45, Math.min(110, maxWeightKg), 1);

    const doseMg = weightBasedDose(perKg, weightKg);
    const chosen = syringes.find((p) => p.strength >= doseMg) ?? syringes[syringes.length - 1];

    return {
      productName: chosen.name,
      substance: chosen.substance,
      code: chosen.code,
      strengthMg: chosen.strength,
      syringeMl: chosen.volumeMl ?? 1,
      perKg,
      weightKg,
      // Na třetí úrovni je dávka zadaná v IU, takže je potřeba převod 100 IU = 1 mg.
      doseUnit: difficulty === 3 ? "IU" : "mg",
      perKgShown: difficulty === 3 ? perKg * 100 : perKg,
      rangeQuote: rule.quote,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const perKg = Number(vars.perKg);
    const weightKg = Number(vars.weightKg);
    const strengthMg = Number(vars.strengthMg);
    const syringeMl = Number(vars.syringeMl);

    const doseMg = weightBasedDose(perKg, weightKg);
    const volumeMl = doseVolume(doseMg, strengthMg, syringeMl);

    return {
      value: volumeMl,
      steps: [
        given(q(weightKg, "kg", 0), q(perKg, "mg/kg", 1), `${q(strengthMg, "mg", 0)} / ${q(syringeMl, "ml", 1)}`),
        intermediate("davkaVMg", {
          formula: `m = D_{\\text{kg}} \\times m_{\\text{@body}}`,
          substituted: `m = ${q(perKg, "", 1)} \\times ${q(weightKg, "kg", 0)}`,
          result: q(doseMg, "mg", 1),
        }),
        formula(`V = ${frac("m", "\\text{@strength}")} \\times V_{\\text{@syringe}}`),
        substitute(`V = ${frac(q(doseMg, "mg", 1), q(strengthMg, "mg", 0))} \\times ${q(syringeMl, "ml", 1)}`),
        result(volumeMl, "ml", 2),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(solution.value),
      decimals: (syringeFor(solution.value) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
