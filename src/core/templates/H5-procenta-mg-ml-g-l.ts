import { ELECTROLYTE_LIST, electrolyteSource } from "../products/electrolytes";
import { PERCENT_SOLUTION_LIST, percentSolutionSource } from "../products/solutions";
import { percentToMgPerMl } from "../formulas";
import * as tolerances from "../tolerances";
import type { AnswerUnit, Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";
import { packageLabel } from "../products/label";

/** Roztoky, které se v praxi označují procenty, ať už jsou to ionty, nebo cukr. */
const LABELLED = [
  ...PERCENT_SOLUTION_LIST.map(([, item]) => ({
    product: packageLabel(item.product),
    percent: item.percent,
    mgPerMl: item.mgPerMl,
  })),
  ...ELECTROLYTE_LIST.map(([, item]) => ({
    product: packageLabel(item.product),
    percent: item.percent,
    mgPerMl: item.mgPerMl,
  })),
];

/**
 * H5 — procenta, mg/ml a g/l jsou tři zápisy téže koncentrace.
 *
 * Převod je definiční: 1 % je 1 g ve 100 ml, tedy 10 mg/ml a zároveň
 * 10 g/l. Šablona nic o léku netvrdí — bere jen skutečné procentní
 * označení registrovaných roztoků, aby zadání odpovídalo tomu, co visí
 * na stojanu.
 */
export const H5 = register({
  id: "H5",
  category: "prevody",
  source: [
    ...PERCENT_SOLUTION_LIST.map(([id]) => percentSolutionSource(id)),
    ...ELECTROLYTE_LIST.map(([id]) => electrolyteSource(id)),
    {
      citation:
        "Definice procentní koncentrace: 1 % (m/V) odpovídá 1 g léčivé látky " +
        "ve 100 ml roztoku, tedy 10 mg/ml a 10 g/l.",
      verifiedAt: "2026-09-03",
    },
  ],

  generate(rng, difficulty) {
    const item = rng.pick(LABELLED);
    const direction = difficulty === 1
      ? "percentToMgPerMl"
      : difficulty === 2
        ? rng.pick(["percentToMgPerMl", "percentToGPerL"] as const)
        : rng.pick(["mgPerMlToPercent", "percentToGPerL"] as const);

    return {
      product: packageLabel(item.product),
      percent: item.percent,
      mgPerMl: item.mgPerMl,
      direction,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const percent = Number(vars.percent);
    const mgPerMl = Number(vars.mgPerMl);
    const definition = intermediate("definiceProcenta", {
      formula: `1\\,\\% = ${frac("1\\,\\mathrm{g}", "100\\,\\mathrm{ml}")} = 10${"\\,\\mathrm{mg/ml}"}`,
    });

    if (vars.direction === "mgPerMlToPercent") {
      return {
        value: percent,
        steps: [
          given(q(mgPerMl, "mg/ml", 1)),
          definition,
          substitute(`${frac(q(mgPerMl, "mg/ml", 1), q(10, "mg/ml", 0))}`, `${tex(percent, 2)}\\,\\%`),
          result(percent, "\\%", 2),
        ],
        roundingNoteKey: "zaokrouhleniPrevod",
      };
    }

    if (vars.direction === "percentToGPerL") {
      // g/l je číselně totéž co mg/ml — gram na litr i miligram na mililitr
      // jsou tisícina na tisícinu.
      const gPerL = mgPerMl;
      return {
        value: gPerL,
        steps: [
          given(`${tex(percent, 2)}\\,\\%`),
          definition,
          intermediate("gramyNaLitr", {
            formula: `${frac("1\\,\\mathrm{g}", "1\\,\\mathrm{l}")} = ${frac("1\\,\\mathrm{mg}", "1\\,\\mathrm{ml}")}`,
            // Definice procenta dala 10 mg/ml, dosazení počítá s 10 g/l —
            // přechod musí být vidět, ne jen obecné pravidlo nad ním.
            result: `${q(10, "mg/ml", 0)} = ${q(10, "g/l", 0)}`,
          }),
          substitute(`${tex(percent, 2)} \\times ${q(10, "g/l", 0)}`, q(gPerL, "g/l", 1)),
          result(gPerL, "g/l", 1),
        ],
        roundingNoteKey: "zaokrouhleniPrevod",
      };
    }

    const converted = percentToMgPerMl(percent);
    return {
      value: converted,
      steps: [
        given(`${tex(percent, 2)}\\,\\%`),
        definition,
        formula("c = p \\times 10"),
        substitute(`${tex(percent, 2)} \\times ${q(10, "mg/ml", 0)}`, q(converted, "mg/ml", 1)),
        result(converted, "mg/ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniPrevod",
    };
  },

  answer(vars, solution) {
    const unit: AnswerUnit =
      vars.direction === "mgPerMlToPercent" ? "percent"
        : vars.direction === "percentToGPerL" ? "gPerL"
          : "mgPerMl";
    return {
      unit,
      tolerance: tolerances.countable(),
      decimals: tolerances.decimalsFor(solution.value, tolerances.countable(), 2),
    };
  },
});
