import { minimumDiluentVolume } from "../formulas";
import { reconstitutionRule, reconstitutionSource } from "../products/reconstitution";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";

/**
 * E3 — objem nosného roztoku pro zadanou konečnou koncentraci.
 *
 * SPC meropenemu udává interval 1–20 mg/ml, ne jedno číslo. Zadání
 * jednu hodnotu z intervalu vybere a ptá se na objem — nutí to číst
 * rozmezí jako rozmezí, ne jako doporučení.
 */
export const E3 = register({
  id: "E3",
  category: "rekonstituce",
  source: reconstitutionSource("meropenem1g"),

  generate(rng, difficulty) {
    const rule = reconstitutionRule("meropenem1g");
    const range = rule.finalRangeMgPerMl!;

    // Dávka, jakou SPC meropenemu uvádí: 500 mg nebo 1 g.
    const doseMg = rng.pick([500, 1000] as const);
    const targetMgPerMl = difficulty === 1
      ? rng.pick([5, 10, 20] as const)
      : rng.step(range.min, range.max, 0.5);

    return {
      productName: packageLabel(rule.product),
      code: rule.suklCode,
      vialMg: rule.vialMg,
      rangeMin: range.min,
      rangeMax: range.max,
      doseMg,
      targetMgPerMl,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseMg = Number(vars.doseMg);
    const target = Number(vars.targetMgPerMl);
    const volumeMl = minimumDiluentVolume(doseMg, target);

    return {
      value: volumeMl,
      steps: [
        given(q(doseMg, "mg", 0), q(target, "mg/ml", 1)),
        formula(`V = ${frac("m", "c")}`),
        substitute(`V = ${frac(q(doseMg, "mg", 0), q(target, "mg/ml", 1))}`),
        result(volumeMl, "ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniObjemVaku",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "ml", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
