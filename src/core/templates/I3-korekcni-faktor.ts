import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

/**
 * I3 — korekční dávka podle pravidla 100.
 *
 * POZOR: šablona je označená `needsReview` a do produkčního setu nepatří.
 *
 * Pravidla 100 a 500 jsou zavedená klinická praxe, ale v SPC inzulinů
 * nejsou a nenašli jsme je ani v žádném zdroji, ke kterému máme přístup.
 * Bez doporučeného postupu odborné společnosti nebo BNF nesmí šablona
 * tvrdit, že se korekční faktor počítá takhle — proto se negeneruje.
 * Kód tu zůstává, aby stačilo doplnit zdroj, ne psát ji znovu.
 */
export const I3 = register({
  id: "I3",
  category: "inzulin",
  needsReview: true,
  source: {
    citation:
      "Nedoloženo. Pravidlo 100 (korekční faktor = 100 / celková denní dávka) je zavedená " +
      "klinická praxe, ale v SPC inzulinů uvedené není. Šablona čeká na doporučený postup " +
      "odborné společnosti nebo na BNF.",
    verifiedAt: "2026-09-03",
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
