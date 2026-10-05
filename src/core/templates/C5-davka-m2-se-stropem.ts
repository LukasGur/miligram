import { bsaBasedDose } from "../formulas";
import { dosingRule, dosingSource } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, intermediate, q, result, substitute } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";
import type { DosingRuleId } from "../products/dosing";

/** Taxany a platina: dávka v mg/m² s rozmezím v SPC. */
const RULES: readonly DosingRuleId[] = ["paklitaxel", "docetaxel", "cisplatina"];

/** Povrch těla, nad který pracoviště dávku nepočítá. */
const CAP_BSA_M2 = 2;

/**
 * C5 — dávka v mg/m² u pracoviště, které počítá nejvýš se 2,0 m².
 *
 * Strop je součástí zadání, ne tvrzení aplikace: SPC ho neuvádí a liší se
 * pracoviště od pracoviště. V praxi se ale stropuje povrch těla, ne
 * miligramy, takže se uplatní jen u velkého pacienta. Strop v mg losovaný
 * kolem spočítané dávky by u malého pacienta byl skrytou redukcí.
 */
export const C5 = register({
  id: "C5",
  category: "povrch",
  source: RULES.map(dosingSource),

  generate(rng, difficulty) {
    const ruleId = rng.pick(RULES);
    const rule = dosingRule(ruleId);
    const range = rule.single!;

    /**
     * Povrch kolem stropu, aby se zhruba v polovině zadání uplatnil a ve
     * druhé ne. Kdyby platil vždy, uživatel by výpočet přestal dělat
     * a rovnou opisoval limit.
     */
    const bsaM2 = difficulty === 1 ? rng.step(1.7, 2.4, 0.1) : rng.step(1.6, 2.5, 0.01);
    const perM2 = difficulty === 1 ? range.max : rng.step(range.min, range.max, 5);

    return { productName: packageLabel(rule.product), substance: rule.substance, code: rule.suklCode, perM2, bsaM2, capBsaM2: CAP_BSA_M2 } satisfies Vars;
  },

  solve(vars): Solution {
    const perM2 = Number(vars.perM2);
    const bsaM2 = Number(vars.bsaM2);
    const capBsaM2 = Number(vars.capBsaM2);

    const usedBsa = Math.min(bsaM2, capBsaM2);
    const doseMg = bsaBasedDose(perM2, usedBsa);

    return {
      value: doseMg,
      steps: [
        given(q(bsaM2, "m^2", 2), q(perM2, "mg/m^2", 0), `\\max ${q(capBsaM2, "m^2", 1)}`),
        intermediate(bsaM2 > capBsaM2 ? "stropSeUplatnil" : "stropSeNeuplatnil", {
          substituted: `\\min(${q(bsaM2, "m^2", 2)},\\; ${q(capBsaM2, "m^2", 1)})`,
          result: q(usedBsa, "m^2", 2),
        }),
        formula(`m = D_{\\text{m}^2} \\times BSA`),
        substitute(`m = ${q(perM2, "mg/m^2", 0)} \\times ${q(usedBsa, "m^2", 2)}`, q(doseMg, "mg", 1)),
        result(doseMg, "mg", 1),
      ],
      roundingNoteKey: "zaokrouhleniOnkologie",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mg", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
