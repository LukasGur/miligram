import { electrolyte, electrolyteSource, POTASSIUM_LIST, POTASSIUM_LIMIT_SOURCE, POTASSIUM_MAX_MMOL_PER_HOUR } from "../products/electrolytes";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { ISO_7886, register } from "./registry";

/**
 * D5 — kolik mililitrů koncentrátu na zadané látkové množství.
 *
 * Draslík se ordinuje v milimolech, ale odměřuje v mililitrech. Obsah
 * iontu v mililitru je v bodě 2 SPC, ne v databázi přípravků — proto
 * má tahle šablona vlastní ověřenou tabulku.
 */
export const D5 = register({
  id: "D5",
  category: "redeni",
  source: [
    ...POTASSIUM_LIST.map(([id]) => electrolyteSource(id)),
    POTASSIUM_LIMIT_SOURCE,
    ISO_7886,
  ],

  generate(rng, difficulty) {
    const [id] = rng.pick(POTASSIUM_LIST);
    const item = electrolyte(id);

    // Ordinace nepřekročí hodinový limit z SPC, aby zadání dávalo smysl.
    const mmol = difficulty === 1
      ? rng.pick([10, 20] as const)
      : rng.step(5, POTASSIUM_MAX_MMOL_PER_HOUR, 2.5);

    return {
      code: item.suklCode,
      productName: item.product,
      ion: item.ion,
      percent: item.percent,
      mmolPerMl: item.mmolPerMl,
      mmol,
      maxPerHour: POTASSIUM_MAX_MMOL_PER_HOUR,
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
