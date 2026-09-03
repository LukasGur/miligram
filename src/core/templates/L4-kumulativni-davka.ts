import { dosingRule, dosingSource } from "../products/dosing";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, result, substitute, tex } from "./helpers";
import { register } from "./registry";

const RULE = "doxorubicin" as const;

/**
 * L4 — kolik cyklů zbývá do celoživotního limitu.
 *
 * Kardiomyopatie po antracyklinech závisí na součtu všeho, co pacient
 * dostal za život, ne na velikosti jednotlivé dávky. Limit je v SPC
 * dvojí: 550 mg/m² obecně a 400 mg/m² u pacienta po ozáření mediastina
 * nebo se srdečním onemocněním. Neúplný cyklus se nepodává, takže se
 * zaokrouhluje dolů.
 */
export const L4 = register({
  id: "L4",
  category: "onkologie",
  source: dosingSource(RULE),

  generate(rng, difficulty) {
    const rule = dosingRule(RULE);
    const range = rule.single;
    if (!range || rule.cumulativeMaxMgPerM2 === undefined || rule.cumulativeRiskMgPerM2 === undefined) {
      throw new Error(`Pravidlo ${RULE} nemá kumulativní limit.`);
    }

    // Rizikový limit se objeví až na třetí úrovni — do té doby platí
    // obecných 550 mg/m² a příklad nemá o čem rozhodovat.
    const atRisk = difficulty === 3 && rng.int(0, 1) === 1;
    const limit = atRisk ? rule.cumulativeRiskMgPerM2 : rule.cumulativeMaxMgPerM2;

    const dosePerCycle = difficulty === 1 ? range.min : rng.step(range.min, range.max, 5);
    // Aspoň jeden cyklus musí zbývat, jinak není co počítat.
    const alreadyGiven = rng.step(dosePerCycle, Math.floor(limit - dosePerCycle), dosePerCycle);

    return {
      productName: rule.product,
      substance: rule.substance,
      code: rule.suklCode,
      atRisk: atRisk ? 1 : 0,
      limitMgPerM2: limit,
      dosePerCycle,
      alreadyGiven,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const limit = Number(vars.limitMgPerM2);
    const dosePerCycle = Number(vars.dosePerCycle);
    const alreadyGiven = Number(vars.alreadyGiven);

    const remaining = limit - alreadyGiven;
    const cycles = Math.floor(remaining / dosePerCycle);

    return {
      value: cycles,
      steps: [
        given(
          `${tex(alreadyGiven, 0)}\\ \\mathrm{mg/m^2}`,
          `${tex(dosePerCycle, 0)}\\ \\mathrm{mg/m^2}\\text{/@cycle}`,
          `${tex(limit, 0)}\\ \\mathrm{mg/m^2}`,
        ),
        intermediate("zbyvaDoLimitu", {
          substituted: `${tex(limit, 0)} - ${tex(alreadyGiven, 0)}`,
          result: `${tex(remaining, 0)}\\ \\mathrm{mg/m^2}`,
        }),
        formula(`n = \\left\\lfloor ${frac("\\text{@remaining}", "\\text{@dosePerCycle}")} \\right\\rfloor`),
        substitute(`n = \\left\\lfloor ${frac(tex(remaining, 0), tex(dosePerCycle, 0))} \\right\\rfloor`),
        result(cycles, "\\text{@cycles}", 0),
      ],
      roundingNoteKey: "zaokrouhleniDolu",
    };
  },

  answer: { unit: "cycle", tolerance: tolerances.countable(), decimals: 0 },
});
