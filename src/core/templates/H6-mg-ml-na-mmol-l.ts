import { electrolyte, electrolyteSource, MOLAR_MASS_LIST } from "../products/electrolytes";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

/** Kolikrát se koncentrát naředí, než se koncentrace udává v mmol/l. */
const DILUTIONS = {
  1: [1, 10] as const,
  2: [2, 5, 10, 20] as const,
  3: [4, 8, 25, 40] as const,
};

/**
 * H6 — z hmotnostní koncentrace na látkovou.
 *
 * Laboratoř hlásí ionty v mmol/l, obal roztoku je značený v mg/ml nebo
 * v procentech. Most mezi nimi je molární hmotnost, a ta musí být ze zdroje:
 * v tabulce jsou jen soli, u kterých ji SPC uvádí tak, že z něj plyne
 * beze zbytku (74,5 g/l = 1000 mmol/l).
 */
export const H6 = register({
  id: "H6",
  category: "prevody",
  source: MOLAR_MASS_LIST.map(([id]) => electrolyteSource(id)),

  generate(rng, difficulty) {
    const [id] = rng.pick(MOLAR_MASS_LIST);
    const item = electrolyte(id);
    const dilution = rng.pick(DILUTIONS[difficulty]);

    return {
      code: item.suklCode,
      productName: item.product,
      ion: item.ion,
      molarMass: item.molarMassGPerMol ?? 0,
      dilution,
      mgPerMl: Number((item.mgPerMl / dilution).toFixed(4)),
    } satisfies Vars;
  },

  solve(vars): Solution {
    const mgPerMl = Number(vars.mgPerMl);
    const molarMass = Number(vars.molarMass);
    // Nejdřív na gramy v litru, teprve pak dělení molární hmotností —
    // opačné pořadí přidává mezikrok, ve kterém se ztrácí řád.
    const gPerL = mgPerMl;
    const mmolPerL = (mgPerMl * 1000) / molarMass;

    return {
      value: mmolPerL,
      steps: [
        given(q(mgPerMl, "mg/ml", 3), `M = ${q(molarMass, "g/mol", 1)}`),
        intermediate("gramyNaLitr", { substituted: `${q(mgPerMl, "mg/ml", 3)} = ${q(gPerL, "g/l", 3)}` }),
        formula(`c_n = ${frac("c_m", "M")}`),
        substitute(`c_n = ${frac(q(gPerL, "g/l", 3), q(molarMass, "g/mol", 1))}`, `${tex(mmolPerL, 2)}\\ \\mathrm{mmol/l}`),
        result(mmolPerL, "mmol/l", 2),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(_vars, solution) {
    const tolerance = tolerances.intermediate();
    return { unit: "mmolPerL", tolerance, decimals: tolerances.decimalsFor(solution.value, tolerance, 2) };
  },
});
