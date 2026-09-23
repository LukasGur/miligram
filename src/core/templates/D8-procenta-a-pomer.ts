import { percentToMgPerMl, percentToRatio, ratioToPercent } from "../formulas";
import * as tolerances from "../tolerances";
import type { Solution } from "../types";
import { frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

/** Koncentrace, se kterými se v praxi pracuje v obou zápisech. */
const PERCENTS = [0.1, 0.5, 1, 2, 5, 10] as const;
const RATIOS = [100, 200, 1000, 10000, 100000] as const;

/**
 * D8 — procenta a poměr jsou dva zápisy téhož.
 *
 * Adrenalin 1:1000 je roztok 0,1 %, lidokain 1 % je 1:100. Šablona
 * převádí oběma směry, protože oba zápisy se v dokumentaci potkávají
 * a záměna posouvá koncentraci o řády.
 */
export const D8 = register({
  id: "D8",
  category: "prevody",
  source: {
    citation:
      "Definice procentního a poměrového vyjádření koncentrace: 1 % odpovídá 1 g " +
      "ve 100 ml roztoku, poměr 1:N odpovídá 1 g v N ml roztoku.",
    verifiedAt: "2026-09-03",
  },

  generate(rng, difficulty) {
    // Na první úrovni se převádí jen z procent, dál oběma směry.
    const direction = difficulty === 1
      ? "percentToRatio"
      : rng.pick(["percentToRatio", "ratioToPercent"] as const);

    // Obě větve nesou obě proměnné, ať má zadání stálý tvar; nepoužitá je nula.
    return direction === "percentToRatio"
      ? { direction, percent: rng.pick(PERCENTS), ratio: 0 }
      : { direction, percent: 0, ratio: rng.pick(RATIOS) };
  },

  solve(vars): Solution {
    if (vars.direction === "percentToRatio") {
      const percent = Number(vars.percent);
      const ratio = percentToRatio(percent);
      return {
        value: ratio,
        steps: [
          given(q(percent, "\\%", 2)),
          intermediate("definiceProcenta", {
            formula: `x\\,\\% = ${frac("x\\,\\mathrm{g}", "100\\,\\mathrm{ml}")} = ${frac("1\\,\\mathrm{g}", "(100/x)\\,\\mathrm{ml}")}`,
          }),
          substitute(`N = ${frac("100", tex(percent, 2))}`),
          result(ratio, "", 0),
        ],
        roundingNoteKey: "zaokrouhleniPomer",
      };
    }

    const ratio = Number(vars.ratio);
    const percent = ratioToPercent(ratio);
    return {
      value: percent,
      steps: [
        given(`1:${ratio}`),
        intermediate("definicePomeru", {
          formula: `1:N = ${frac("1\\,\\mathrm{g}", "N\\,\\mathrm{ml}")}`,
        }),
        substitute(`x = ${frac("100", String(ratio))}`, `${tex(percent, 4)}\\,\\%`),
        intermediate("koncentrace", {
          substituted: `c = ${tex(percent, 4)} \\times ${q(10, "mg/ml", 0)}`,
          result: q(percentToMgPerMl(percent), "mg/ml", 3),
        }),
        result(percent, "\\%", 4),
      ],
      roundingNoteKey: "zaokrouhleniPomer",
    };
  },

  answer(vars, solution) {
    // Odpovědí je N ze zápisu 1:N, ne procento — pole odpovědi to musí
    // říct, jinak by u výsledku 50 svítilo „%“ a zadání by si protiřečilo.
    return vars.direction === "percentToRatio"
      ? { unit: "ratio", tolerance: tolerances.countable(), decimals: 0 }
      : {
          unit: "percent",
          tolerance: tolerances.intermediate(),
          decimals: tolerances.decimalsFor(solution.value, tolerances.intermediate()),
        };
  },
});
