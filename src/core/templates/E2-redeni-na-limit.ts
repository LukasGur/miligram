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

/** Pravidla, která uvádějí strop koncentrace v hotové infuzi. */
const RULES = RECONSTITUTION_LIST
  .filter(([, rule]) => rule.maxInfusionMgPerMl !== undefined)
  .map(([id]) => id) as readonly ReconstitutionRuleId[];

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

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = reconstitutionRule(ruleId);

    // Podává se buď celá lahvička, nebo její část podle hmotnosti pacienta.
    const fraction = difficulty === 1 ? 1 : rng.step(0.5, 1, 0.05);
    const doseMg = Number((rule.vialMg * fraction).toPrecision(3));

    return {
      ruleId,
      productName: rule.product,
      code: rule.suklCode,
      vialMg: rule.vialMg,
      diluentMl: rule.diluentMl,
      reconstitutedMgPerMl: rule.reconstitutedMgPerMl,
      maxInfusionMgPerMl: rule.maxInfusionMgPerMl ?? 5,
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
