import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

/**
 * I3 — korekční dávka podle pravidla 100.
 *
 * POZOR: šablona je označená `needsReview` a do produkčního setu nepatří.
 *
 * Zdroj se našel: konsenzuální doporučený postup ISPAD z roku 2022 pravidlo
 * uvádí výslovně („The usual 100/TDD for mmol/l (or 1800 for mg/dL)“).
 * V SPC inzulinů pravidlo není a nikdy nebude — je to postup, jak dávku
 * spočítat, ne údaj o přípravku.
 *
 * Zbývá rozhodnutí, které není naše: CLAUDE.md připouští SÚKL, ŠÚKL, SPC,
 * AISLP a BNF, a ISPAD mezi nimi není. Doporučený postup odborné společnosti
 * je jiný druh zdroje než souhrn údajů o přípravku a rozšířit ten seznam
 * má smysl jen vědomě. Do té doby se šablona negeneruje.
 */
export const I3 = register({
  id: "I3",
  category: "inzulin",
  needsReview: true,
  source: {
    citation:
      "Sundberg F, deBeaufort C, Krogvold L, et al. ISPAD Clinical Practice Consensus " +
      "Guidelines 2022: Managing diabetes in preschoolers. Pediatr Diabetes. " +
      "2022;23(8):1496–1511. doi:10.1111/pedi.13427 — „The usual 100/TDD for mmol/l " +
      "(or 1800 for mg/dL) often needs to be adjusted…“. Pravidlo 100 tedy stojí " +
      "v doporučeném postupu odborné společnosti, ne v SPC. Seznam zdrojů v CLAUDE.md " +
      "ISPAD zatím neuvádí, proto šablona čeká na rozhodnutí, jestli tam patří.",
    verifiedAt: "2026-09-18",
  },

  generate(rng, difficulty) {
    const totalDailyIU = difficulty === 1 ? rng.step(20, 60, 10) : rng.step(24, 80, 2);
    const targetMmolPerL = rng.pick([5.5, 6, 6.5] as const);
    const currentMmolPerL = difficulty === 3
      ? rng.step(9.4, 18.2, 0.4)
      : rng.step(10, 18, 1);

    return { totalDailyIU, targetMmolPerL, currentMmolPerL } satisfies Vars;
  },

  solve(vars): Solution {
    const totalDailyIU = Number(vars.totalDailyIU);
    const current = Number(vars.currentMmolPerL);
    const target = Number(vars.targetMmolPerL);

    const correctionFactor = 100 / totalDailyIU;
    const excess = current - target;
    const doseIU = excess / correctionFactor;

    return {
      value: doseIU,
      steps: [
        given(q(totalDailyIU, "IU", 0), `${tex(current, 1)}\\ \\mathrm{mmol/l}`, `${tex(target, 1)}\\ \\mathrm{mmol/l}`),
        intermediate("korekcniFaktor", {
          formula: `\\mathrm{KF} = ${frac("100", "\\text{@totalDailyDose}")}`,
          substituted: `\\mathrm{KF} = ${frac("100", tex(totalDailyIU, 0))}`,
          result: `${tex(correctionFactor, 2)}\\ \\mathrm{mmol/l\\ na\\ 1\\ IU}`,
        }),
        formula(`d = ${frac("\\text{@glycemia} - \\text{@target}", "\\mathrm{KF}")}`),
        substitute(`d = ${frac(`${tex(excess, 1)}\\ \\mathrm{mmol/l}`, `${tex(correctionFactor, 2)}`)}`),
        result(doseIU, "IU", 1),
      ],
      roundingNoteKey: "zaokrouhleniInzulinPulJednotky",
    };
  },

  // Pero se nastavuje po půl jednotce, takže jemnější odpověď nejde podat.
  answer: { unit: "IU", tolerance: { kind: "absolute", value: 0.5 }, decimals: 1 },
});
