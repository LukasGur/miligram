import { minimumDiluentVolume } from "../formulas";
import {
  RECONSTITUTION_LIST,
  reconstitutionRule,
  reconstitutionSource,
  type ReconstitutionRuleId,
} from "../products/reconstitution";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";
import { dosingRule, dosingSource } from "../products/dosing";

/** Pravidla, která uvádějí strop koncentrace v hotové infuzi. */
/**
 * Lahvičky s mezí koncentrace v infuzi: vankomycin (nejvýš 5 mg/ml)
 * a meropenem (konečná koncentrace nejvýš 20 mg/ml, týž bod SPC jako E3).
 */
const RULES = RECONSTITUTION_LIST
  .filter(([, rule]) => rule.maxInfusionMgPerMl !== undefined || rule.finalRangeMgPerMl !== undefined)
  .map(([id]) => id) as readonly ReconstitutionRuleId[];

/** Mez koncentrace v infuzi podle SPC. */
function limitOf(id: ReconstitutionRuleId): number {
  const rule = reconstitutionRule(id);
  return rule.maxInfusionMgPerMl ?? rule.finalRangeMgPerMl!.max;
}

/**
 * E2 — nejmenší objem infuze, aby se nepřekročil strop koncentrace.
 *
 * Dva kroky, které se často slepí do jednoho: rekonstituce dá koncentrát,
 * ten se ale nesmí podat — musí se ještě naředit pod limit z SPC.
 */
export const E2 = register({
  id: "E2",
  category: "rekonstituce",
  source: RULES.map(reconstitutionSource),
  // Dávka vankomycinu podle hmotnosti pochází z jeho dávkování v SPC.
  sourceFor: (vars) => (String(vars.ruleId).startsWith("vankomycin") ? [dosingSource("vankomycin")] : []),

  generate(rng, difficulty) {
    /**
     * Dávka, jakou SPC uvádí. Vankomycin 15–20 mg/kg na padesátky,
     * u lehčích pacientů a dětí z lahvičky 500 mg nebo 1 g, kam se vejde;
     * meropenem 500 mg nebo 1 g. Dřív to byl zlomek lahvičky po 5 %.
     */
    const meropenem = rng.int(0, 2) === 0;
    let ruleId: ReconstitutionRuleId;
    let doseMg: number;
    if (meropenem) {
      ruleId = "meropenem1g";
      doseMg = rng.pick([500, 1000]);
    } else {
      const range = dosingRule("vankomycin").single!;
      const weightKg = difficulty === 1 ? rng.step(30, 65, 5) : rng.step(15, 66, 1);
      const perKg = difficulty === 1 ? rng.pick([range.min, range.max]) : rng.step(range.min, range.max, 1);
      doseMg = Math.min(1000, Math.max(250, Math.round((perKg * weightKg) / 50) * 50));
      ruleId = doseMg <= 500 ? rng.pick(["vankomycin500", "vankomycin1g"] as const) : "vankomycin1g";
    }
    const rule = reconstitutionRule(ruleId);

    return {
      ruleId,
      productName: packageLabel(rule.product),
      code: rule.suklCode,
      vialMg: rule.vialMg,
      diluentMl: rule.diluentMl,
      reconstitutedMgPerMl: rule.reconstitutedMgPerMl,
      maxInfusionMgPerMl: limitOf(ruleId),
      doseMg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseMg = Number(vars.doseMg);
    const maxMgPerMl = Number(vars.maxInfusionMgPerMl);
    const minVolumeMl = minimumDiluentVolume(doseMg, maxMgPerMl);

    return {
      value: minVolumeMl,
      steps: [
        given(q(doseMg, "mg", 1), `\\max ${q(maxMgPerMl, "mg/ml", 1)}`),
        intermediate("limitKoncentrace", {
          formula: `c = ${frac("m", "V")} \\le c_{\\max}`,
        }),
        formula(`V_{\\min} = ${frac("m", "c_{\\max}")}`),
        substitute(`V_{\\min} = ${frac(q(doseMg, "mg", 1), q(maxMgPerMl, "mg/ml", 1))}`),
        result(minVolumeMl, "ml", 0),
      ],
      roundingNoteKey: "zaokrouhleniObjemVaku",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "ml", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
