import { doseSourceFor, dosedProducts, pickDose, tabletCount } from "./ampouleDoses";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * A7 — kolik balení na celou kúru.
 *
 * Otázka z ambulance, ne od lůžka: kolik krabiček předepsat, aby pacient
 * dobral. Zaokrouhluje se nahoru, protože polovinu krabičky lékárna nevydá.
 */
export const A7 = register({
  id: "A7",
  category: "zaklad",
  source: SUKL_DLP,

  sourceFor: doseSourceFor,

  generate(rng, difficulty) {
    /**
     * Režim i délka léčby podle SPC. Dřív se losovalo „2 tbl 3× denně
     * po 60 dní“ i u klopidogrelu 300 mg. Kúra antibiotika trvá, kolik
     * uvádí SPC; u léčby, kterou SPC popisuje jako dlouhodobou, se
     * předepisuje na 28 až 90 dní.
     */
    const candidates = dosedProducts("tablet").filter(
      (candidate) => candidate.dose.timesPerDay && candidate.dose.course && candidate.product.packCount,
    );
    const { item, doseMg } = pickDose(rng, candidates, (dose, candidate) => {
      const count = tabletCount(dose, candidate);
      return count !== null && (difficulty !== 1 || count === 1);
    });
    const perDose = tabletCount(doseMg, item) ?? 1;
    const timesPerDay = rng.pick(item.dose.timesPerDay ?? [1]);
    const course = item.dose.course ?? "longTerm";
    const days =
      course === "longTerm"
        ? difficulty === 1 ? rng.pick([28, 30, 90] as const) : rng.int(28, 90)
        : difficulty === 1 ? rng.pick([course.min, course.max]) : rng.int(course.min, course.max);

    return {
      code: item.product.code,
      productName: item.product.name,
      substance: item.product.substance,
      strengthMg: item.contentMg,
      packCount: item.product.packCount ?? 30,
      perDose,
      timesPerDay,
      days,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const perDose = Number(vars.perDose);
    const timesPerDay = Number(vars.timesPerDay);
    const days = Number(vars.days);
    const packCount = Number(vars.packCount);

    const totalTablets = perDose * timesPerDay * days;
    const packs = Math.ceil(totalTablets / packCount - 1e-9);

    return {
      value: packs,
      steps: [
        given(`${q(perDose, "tbl", 1)} \\times ${timesPerDay}\\text{/@day}`, `${days}\\text{ @days}`, `${packCount}\\text{ tbl/@packShort}`),
        intermediate("celkovaSpotreba", {
          formula: `n_{\\text{tbl}} = \\text{@dose} \\times \\text{@frequency} \\times \\text{@days}`,
          substituted: `n_{\\text{tbl}} = ${q(perDose, "tbl", 1)} \\times ${timesPerDay} \\times ${days}`,
          result: q(totalTablets, "tbl", 1),
        }),
        formula(`n_{\\text{@packShort}} = \\left\\lceil ${frac("n_{\\text{tbl}}", "\\text{@packContent}")} \\right\\rceil`),
        substitute(`n_{\\text{@packShort}} = \\left\\lceil ${frac(q(totalTablets, "tbl", 1), q(packCount, "tbl", 0))} \\right\\rceil`),
        result(packs, "@packShort", 0),
      ],
      roundingNoteKey: "zaokrouhleniBaleni",
    };
  },

  answer: { unit: "pack", tolerance: tolerances.countable(), decimals: 0 },
});
