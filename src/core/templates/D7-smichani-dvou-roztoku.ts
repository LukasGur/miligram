import { mixedConcentration } from "../formulas";
import { concentrationOf, selectProducts } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

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
  source: SUKL_DLP,

  generate(rng, difficulty) {
    /**
     * Obě složky musí být tatáž látka v různé koncentraci, jinak by míchání
     * nedávalo smysl. Ve fondu takové dvojice existují u glukózy a chloridu.
     */
    const candidates = selectProducts({ kind: "infusionBag", strengthUnit: "mg", minStrength: 1 })
      .concat(selectProducts({ kind: "concentrate", strengthUnit: "mg", minStrength: 1 }));

    const bySubstance = new Map<string, typeof candidates>();
    for (const item of candidates) {
      const list = bySubstance.get(item.substance) ?? [];
      list.push(item);
      bySubstance.set(item.substance, list);
    }
    const pairs = [...bySubstance.values()].filter((list) => {
      const concentrations = new Set(list.map((p) => concentrationOf(p)));
      return concentrations.size >= 2;
    });
    if (pairs.length === 0) throw new Error("Ve fondu není dvojice roztoků téže látky v různé koncentraci.");

    const group = rng.pick(pairs).slice().sort((a, b) => concentrationOf(a) - concentrationOf(b));
    const weaker = group[0];
    const stronger = group[group.length - 1];

    const volumeA = difficulty === 1 ? rng.pick([100, 250, 500] as const) : rng.step(50, 500, 50);
    const volumeB = difficulty === 1 ? rng.pick([100, 250] as const) : rng.step(20, 250, 10);

    return {
      substance: weaker.substance,
      codeA: weaker.code,
      productA: weaker.name,
      concentrationA: concentrationOf(weaker),
      volumeA,
      codeB: stronger.code,
      productB: stronger.name,
      concentrationB: concentrationOf(stronger),
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
