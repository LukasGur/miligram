import { bsaBasedDose } from "../formulas";
import { dosingRule, dosingSource } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, intermediate, q, result, substitute } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";

/**
 * C5 — dávka v mg/m² omezená stropem z protokolu.
 *
 * Strop je součástí zadání, ne tvrzení aplikace: horní hranice se liší
 * protokol od protokolu a do SPC nepatří. Šablona proto neříká „maximum je“,
 * ale „protokol pracoviště omezuje dávku na“.
 */
export const C5 = register({
  id: "C5",
  category: "povrch",
  source: dosingSource("paklitaxel"),

  generate(rng, difficulty) {
    const rule = dosingRule("paklitaxel");
    const range = rule.single!;

    const bsaM2 = difficulty === 1 ? rng.step(1.7, 2.2, 0.1) : rng.step(1.4, 2.4, 0.01);
    const perM2 = difficulty === 1 ? range.max : rng.step(range.min, range.max, 5);

    /**
     * Strop se volí kolem spočítané dávky, aby se zhruba v polovině zadání
     * uplatnil a ve druhé ne. Kdyby platil vždy, uživatel by výpočet
     * přestal dělat a rovnou opisoval limit.
     */
    const computed = bsaBasedDose(perM2, bsaM2);
    const capMg = Math.round((computed * rng.step(0.8, 1.2, 0.05)) / 10) * 10;

    return { productName: packageLabel(rule.product), substance: rule.substance, code: rule.suklCode, perM2, bsaM2, capMg } satisfies Vars;
  },

  solve(vars): Solution {
    const perM2 = Number(vars.perM2);
    const bsaM2 = Number(vars.bsaM2);
    const capMg = Number(vars.capMg);

    const computed = bsaBasedDose(perM2, bsaM2);
    const doseMg = Math.min(computed, capMg);

    return {
      value: doseMg,
      steps: [
        given(q(bsaM2, "m^2", 2), q(perM2, "mg/m^2", 0), `\\max ${q(capMg, "mg", 0)}`),
        formula(`m = D_{\\text{m}^2} \\times BSA`),
        substitute(`m = ${q(perM2, "mg/m^2", 0)} \\times ${q(bsaM2, "m^2", 2)}`, q(computed, "mg", 1)),
        intermediate(doseMg < computed ? "stropSeUplatnil" : "stropSeNeuplatnil", {
          substituted: `\\min(${q(computed, "mg", 1)},\\; ${q(capMg, "mg", 0)})`,
          result: q(doseMg, "mg", 1),
        }),
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
