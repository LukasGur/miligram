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
    /**
     * Nejdřív dávka, pak balení. Dávka drží rozmezí z SPC: profylaxe
     * 20 nebo 40 mg, léčba 1 mg/kg dvakrát denně nebo 1,5 mg/kg jednou.
     * Dřív se losoval násobek balení, a z lahvičky 300 mg tak vycházelo
     * 600 mg enoxaparinu na dávku.
     */
    const doseMg =
      difficulty === 1
        ? rng.pick([20, 40, 60, 80, 100])
        : difficulty === 2
          ? rng.step(30, 150, 10)
          : Math.round((rng.pick([1, 1.5]) * rng.step(50, 120, 1)) / 5) * 5;

    /**
     * Balení, ze kterého se dávka bere: předplněná stříkačka nebo lahvička,
     * vždy s víc, než je dávka. Stejná dávka jako na obalu by se jen opsala
     * ze závorky, takže tu není.
     */
    const product = pickProduct(rng, {
      kind: "ampoule",
      strengthUnit: "mg",
      atcPrefixes: ["B01AB05"],
      containers: ["prefilledSyringe", "vial"],
      minStrength: doseMg + 1,
      maxStrength: 300,
    });
    const activityIU = product.activityIU;
    if (activityIU === undefined) {
      throw new Error(`${product.name} nemá dvojí značení, přepočet z něj odvodit nelze.`);
    }
    const iuPerMg = activityIU / product.strength;

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      labelMg: product.strength,
      labelIU: activityIU,
      iuPerMg,
      direction: rng.int(0, 1) === 1 ? "iuToMg" : "mgToIu",
      givenMg: doseMg,
      givenIU: Math.round(doseMg * iuPerMg),
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
