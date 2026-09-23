import { pickProduct } from "../products";
import * as tolerances from "../tolerances";
import type { AnswerUnit, Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { dosingSource } from "../products/dosing";
import { register, SUKL_DLP } from "./registry";

/**
 * H4 — mezinárodní jednotky a miligramy u téhož přípravku.
 *
 * Nízkomolekulární heparin je na obalu značený dvojmocně: 6 000 IU (60 mg).
 * Obě čísla popisují tutéž látku, takže z nich jde odvodit přepočet —
 * ale platí jen pro tenhle přípravek, ne pro heparin obecně. Právě to je
 * na šabloně to podstatné.
 */
export const H4 = register({
  id: "H4",
  category: "prevody",
  source: [SUKL_DLP, dosingSource("enoxaparin")],

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "ampoule",
      strengthUnit: "mg",
      atcPrefixes: ["B01AB05"],
      maxStrength: 300,
    });
    const activityIU = product.activityIU;
    if (activityIU === undefined) {
      throw new Error(`${product.name} nemá dvojí značení, přepočet z něj odvodit nelze.`);
    }
    const iuPerMg = activityIU / product.strength;

    /**
     * Zadané množství se losuje jako násobek síly balení, ať zadání
     * odpovídá tomu, co lze reálně podat. Násobek 1 mezi nimi schválně
     * není: obě čísla celého balení jsou v zadání vedle sebe, takže by
     * se student neptal na výpočet, ale opisoval ze závorky.
     */
    const shareOptions =
      difficulty === 1 ? [0.5, 2] : difficulty === 2 ? [0.5, 1.5, 2] : [0.25, 0.75, 1.25, 2.5];
    const share = rng.pick(shareOptions);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      labelMg: product.strength,
      labelIU: activityIU,
      iuPerMg,
      direction: rng.int(0, 1) === 1 ? "iuToMg" : "mgToIu",
      givenMg: Number((product.strength * share).toFixed(2)),
      givenIU: Number((activityIU * share).toFixed(0)),
    } satisfies Vars;
  },

  solve(vars): Solution {
    const iuPerMg = Number(vars.iuPerMg);
    const labelMg = Number(vars.labelMg);
    const labelIU = Number(vars.labelIU);
    const ratioStep = intermediate("dvojiZnaceni", {
      substituted: `${frac(q(labelIU, "IU", 0), q(labelMg, "mg", 0))} = ${tex(iuPerMg, 2)}\\ \\mathrm{IU/mg}`,
    });

    if (vars.direction === "iuToMg") {
      const givenIU = Number(vars.givenIU);
      const mg = givenIU / iuPerMg;
      return {
        value: mg,
        steps: [
          given(q(givenIU, "IU", 0)),
          ratioStep,
          formula(`m = ${frac("\\text{@activity}", "\\text{@iuPerMg}")}`),
          substitute(`m = ${frac(q(givenIU, "IU", 0), `${tex(iuPerMg, 2)}\\ \\mathrm{IU/mg}`)}`),
          result(mg, "mg", 2),
        ],
        roundingNoteKey: "zaokrouhleniMezivysledek",
      };
    }

    const givenMg = Number(vars.givenMg);
    const iu = givenMg * iuPerMg;
    return {
      value: iu,
      steps: [
        given(q(givenMg, "mg", 2)),
        ratioStep,
        formula("\\text{@activity} = m \\times \\text{@iuPerMg}"),
        substitute(`${q(givenMg, "mg", 2)} \\times ${tex(iuPerMg, 2)}\\ \\mathrm{IU/mg}`, q(iu, "IU", 0)),
        result(iu, "IU", 0),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(vars, solution) {
    const unit: AnswerUnit = vars.direction === "iuToMg" ? "mg" : "IU";
    const tolerance = tolerances.intermediate();
    return { unit, tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance, 2) };
  },
});
