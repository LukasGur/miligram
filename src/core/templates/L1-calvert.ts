import { calvertDose } from "../formulas";
import { AUC_TARGETS, CALVERT_PAPER, CALVERT_SPC } from "../products/oncology";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, given, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

/**
 * L1 — dávka karboplatiny podle Calverta.
 *
 * Jediný vzorec v aplikaci, který nedává mg/m², ale rovnou miligramy —
 * SPC na to zvlášť upozorňuje. Kdo výsledek ještě vynásobí povrchem těla,
 * podá řádově víc.
 */
export const L1 = register({
  id: "L1",
  category: "onkologie",
  source: [CALVERT_PAPER, CALVERT_SPC],

  generate(rng, difficulty) {
    const target = rng.pick(AUC_TARGETS);
    const gfrMlPerMin = difficulty === 1
      ? rng.step(60, 100, 10)
      : difficulty === 2
        ? rng.step(45, 110, 5)
        : rng.step(28, 118, 1);

    return { auc: target.auc, regimen: target.regimen, gfrMlPerMin } satisfies Vars;
  },

  solve(vars): Solution {
    const auc = Number(vars.auc);
    const gfr = Number(vars.gfrMlPerMin);
    const doseMg = calvertDose(auc, gfr);

    return {
      value: doseMg,
      steps: [
        given(`AUC = ${tex(auc, 0)}\\ \\mathrm{mg/ml\\cdot min}`, q(gfr, "ml/min", 0)),
        formula("D = AUC \\times (GFR + 25)"),
        substitute(`D = ${tex(auc, 0)} \\times (${tex(gfr, 0)} + 25)`),
        substitute(`D = ${tex(auc, 0)} \\times ${tex(gfr + 25, 0)}`, q(doseMg, "mg", 0)),
        result(doseMg, "mg", 0),
      ],
      roundingNoteKey: "zaokrouhleniDavka",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mg", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance, 1) };
  },
});
