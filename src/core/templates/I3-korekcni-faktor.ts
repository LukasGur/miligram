import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { register } from "./registry";

/**
 * I3 — korekční dávka podle pravidla 100.
 *
 * Korekční faktor (citlivost na inzulin) říká, o kolik mmol/l srazí jedna
 * jednotka rychlého inzulinu glykemii. Pravidlo 100 ho odhaduje z celkové
 * denní dávky a takhle ho uvádí konsenzuální doporučený postup ISPAD 2022.
 *
 * Je to odhad pro začátek, ne předpis. Český doporučený postup (Prázný M,
 * Rušavý Z, Šumník Z, et al. Použití inzulinové pumpy a glukózových
 * senzorů. DMEV. 2019;22(4):152–169) pravidlo neuvádí vůbec a žádá, aby
 * korekční bolus určil lékař individuálně; plošné užívání bolusových
 * kalkulátorů mimo pumpy a certifikovaná zařízení výslovně nedoporučuje.
 * Zadání proto mluví o pravidle 100, ne o dávce, kterou má student podat
 * pacientovi — cvičí se výpočet, ne ordinace.
 */

export const I3 = register({
  id: "I3",
  category: "inzulin",
  source: {
    citation:
      "Sundberg F, deBeaufort C, Krogvold L, et al. ISPAD Clinical Practice Consensus " +
      "Guidelines 2022: Managing diabetes in preschoolers. Pediatr Diabetes. " +
      "2022;23(8):1496–1511. doi:10.1111/pedi.13427 — „The usual 100/TDD for mmol/l " +
      "(or 1800 for mg/dL) often needs to be adjusted…“. Korekční faktor je odhad " +
      "pro začátek; podle českého doporučeného postupu (DMEV. 2019;22(4):152–169) " +
      "ho lékař určuje individuálně.",
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
