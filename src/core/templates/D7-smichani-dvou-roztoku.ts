import { mixedConcentration } from "../formulas";
import { PERCENT_SOLUTION_LIST, percentSolutionSource } from "../products/solutions";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";

/** Glukóza od nejslabší po nejsilnější. */
const GLUCOSE = PERCENT_SOLUTION_LIST.filter(([, item]) => item.substance === "GLUKÓZA").sort(
  ([, a], [, b]) => a.mgPerMl - b.mgPerMl,
);

/**
 * D7 — koncentrace po smíchání dvou roztoků téže látky.
 *
 * Vážený průměr, ne prostý. Kdo sečte obě koncentrace a vydělí dvěma,
 * dostane správný výsledek jen při stejných objemech — a to zadání
 * záměrně nikdy nenastane.
 */
export const D7 = register({
  id: "D7",
  category: "redeni",
  // Glukóza ve čtyřech koncentracích ze SPC jednoho výrobce: smíchání
  // 5% a 40% glukózy je běžná příprava, ne vymyšlená úloha.
  source: GLUCOSE.map(([id]) => percentSolutionSource(id)),

  generate(rng, difficulty) {
    /**
     * Obě složky musí být tatáž látka v různé koncentraci. Dřív se dvojice
     * hledaly v celém fondu a vycházelo třeba 500 ml docetaxelu slité se
     * 60 ml Taxoteru — pět gramů cytostatika v jednom vaku. Teď jen glukóza
     * a objemy podle balení, které výrobce dodává.
     */
    const low = rng.int(0, GLUCOSE.length - 2);
    const weaker = GLUCOSE[low][1];
    const stronger = GLUCOSE[rng.int(low + 1, GLUCOSE.length - 1)][1];

    const volumeFor = (packs: readonly number[], step: number) =>
      difficulty === 1 ? rng.pick(packs) : rng.step(step, Math.max(...packs), step);
    const volumeA = volumeFor(weaker.packSizesMl, 50);
    // Stejné objemy by dovolily spočítat prostý průměr; zadání se jim vyhne.
    let volumeB = volumeFor(stronger.packSizesMl, 10);
    while (volumeB === volumeA) volumeB = volumeFor(stronger.packSizesMl, 10);

    return {
      substance: weaker.substance,
      codeA: weaker.suklCode,
      productA: packageLabel(weaker.product),
      concentrationA: weaker.mgPerMl,
      volumeA,
      codeB: stronger.suklCode,
      productB: packageLabel(stronger.product),
      concentrationB: stronger.mgPerMl,
      volumeB,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const cA = Number(vars.concentrationA);
    const vA = Number(vars.volumeA);
    const cB = Number(vars.concentrationB);
    const vB = Number(vars.volumeB);

    const total = vA + vB;
    const result_ = mixedConcentration(
      [{ concentration: cA, volumeMl: vA }, { concentration: cB, volumeMl: vB }],
      total,
    );

    return {
      value: result_,
      steps: [
        given(`${q(vA, "ml", 0)} \\times ${q(cA, "mg/ml", 2)}`, `${q(vB, "ml", 0)} \\times ${q(cB, "mg/ml", 2)}`),
        formula(`c = ${frac("c_A V_A + c_B V_B", "V_A + V_B")}`),
        substitute(
          `c = ${frac(
            `${q(cA, "mg/ml", 2)} \\times ${q(vA, "ml", 0)} + ${q(cB, "mg/ml", 2)} \\times ${q(vB, "ml", 0)}`,
            `${q(vA, "ml", 0)} + ${q(vB, "ml", 0)}`,
          )}`,
        ),
        substitute(`c = ${frac(q(cA * vA + cB * vB, "mg", 1), q(total, "ml", 0))}`),
        result(result_, "mg/ml", 2),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mgPerMl", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance) };
  },
});
