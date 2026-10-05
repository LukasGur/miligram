import { electrolyte, electrolyteSource, MMOL_PER_ML_LIST } from "../products/electrolytes";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { ISO_7886, register } from "./registry";
import { packageLabel } from "../products/label";

/**
 * D5 — kolik mililitrů koncentrátu na zadané látkové množství.
 *
 * Elektrolyty se ordinují v milimolech, ale odměřují v mililitrech. Obsah
 * iontu v mililitru je v bodě 2 SPC, ne v databázi přípravků — proto má
 * tahle šablona vlastní ověřenou tabulku.
 *
 * Draselné a sodné koncentráty z ní vypadly: mají 1 mmol/ml, takže počet
 * mililitrů je roven počtu milimolů a ptát se na něj znamená nechat
 * studenta opsat číslo ze zadání. Zbývá hořčík, kde přepočet něco stojí.
 */
export const D5 = register({
  id: "D5",
  category: "redeni",
  source: [...MMOL_PER_ML_LIST.map(([id]) => electrolyteSource(id)), ISO_7886],

  generate(rng, difficulty) {
    const [id] = rng.pick(MMOL_PER_ML_LIST);
    const item = electrolyte(id);

    // Kolik se ordinuje, je součást zadání, ne tvrzení ze zdroje.
    const mmol = difficulty === 1 ? rng.pick([4, 8, 12] as const) : rng.step(3, 24, 1);

    return {
      code: item.suklCode,
      productName: packageLabel(item.product),
      ion: item.ion,
      percent: item.percent,
      mmolPerMl: item.mmolPerMl,
      mmol,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const mmol = Number(vars.mmol);
    const mmolPerMl = Number(vars.mmolPerMl);
    const volumeMl = mmol / mmolPerMl;

    return {
      value: volumeMl,
      steps: [
        given(q(mmol, "mmol", 1), `${q(mmolPerMl, "mmol/ml", 2)}`),
        formula(`V = ${frac("n", "n_{\\text{ml}}")}`),
        substitute(`V = ${frac(q(mmol, "mmol", 1), q(mmolPerMl, "mmol/ml", 2))}`),
        result(volumeMl, "ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(Math.min(solution.value, 50)),
      decimals: (syringeFor(Math.min(solution.value, 50)) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
