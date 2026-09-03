import { microgramsPerKgMinToMlPerHour } from "../formulas";
import { PUMP_SOURCE } from "../devices";
import { concentrationOf, selectProducts, vialContentMg } from "../products";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { frac, step, tex, unit } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/** Objemy stříkaček do lineárního dávkovače. */
const SYRINGE_VOLUMES_ML = [20, 50] as const;

/**
 * G2 — kontinuální infuze v µg/kg/min.
 *
 * Nejnáročnější běžný převod: mění se čas i řád jednotky současně.
 * Zadaná dávka pochází z rozmezí, koncentrace z reálného ředění.
 */
export const G2 = register({
  id: "G2",
  category: "vazoaktivni",
  source: [SUKL_DLP, PUMP_SOURCE],

  generate(rng, difficulty) {
    const weightKg = rng.step(50, 95, 5);
    const dosePerKgMin = difficulty === 1
      ? rng.pick([2, 5, 10] as const)
      : rng.step(0.5, 20, 0.5);

    /**
     * Přípravek ani ředění se nelosují nezávisle na dávce. V praxi se ředění
     * volí tak, aby pumpa běžela v rozumném rozsahu — u příliš zředěného
     * roztoku by vycházely stovky ml/h, které dávkovač neumí nastavit
     * a pacient by je neunesl. Z proveditelných kombinací proto losujeme
     * a v rámci přípravku bereme tu, která míří nejblíž k 10 ml/h.
     */
    const options = selectProducts({
      kind: "concentrate",
      strengthUnit: "mg",
      atcPrefixes: ["C01C", "C01D", "N01A", "N05C"],
    }).flatMap((candidate) =>
      SYRINGE_VOLUMES_ML.flatMap((syringeMl) =>
        [1, 2, 3, 4].map((ampoules) => {
          const totalMg = vialContentMg(candidate) * ampoules;
          const rate = microgramsPerKgMinToMlPerHour(dosePerKgMin, weightKg, totalMg / syringeMl);
          return { candidate, syringeMl, ampoules, totalMg, rate };
        }),
      ),
    ).filter((option) => option.rate >= 0.5 && option.rate <= 60);

    if (options.length === 0) {
      throw new Error(`Pro dávku ${dosePerKgMin} µg/kg/min u ${weightKg} kg nevychází žádné ředění.`);
    }

    const product = rng.pick([...new Set(options.map((o) => o.candidate))]);
    const chosen = options
      .filter((o) => o.candidate === product)
      .reduce((best, option) =>
        Math.abs(Math.log(option.rate / 10)) < Math.abs(Math.log(best.rate / 10)) ? option : best,
      );
    const { syringeMl, ampoules, totalMg } = chosen;
    const concentrationMgPerMl = totalMg / syringeMl;

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      ampouleMg: vialContentMg(product),
      ampouleMl: product.packUnitVolumeMl ?? product.volumeMl ?? 1,
      ampouleConcentration: concentrationOf(product),
      ampoules,
      syringeMl,
      totalMg,
      concentrationMgPerMl,
      weightKg,
      dosePerKgMin,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const totalMg = Number(vars.totalMg);
    const syringeMl = Number(vars.syringeMl);
    const weightKg = Number(vars.weightKg);
    const dose = Number(vars.dosePerKgMin);
    const concentration = totalMg / syringeMl;
    const rate = microgramsPerKgMinToMlPerHour(dose, weightKg, concentration);

    return {
      value: rate,
      steps: [
        step("zadani", {
          result: `${tex(totalMg, 1)}${unit("mg")} / ${tex(syringeMl, 0)}${unit("ml")},\; ${tex(weightKg, 0)}${unit("kg")},\; ${tex(dose, 2)}${unit("\\mu g/kg/min")}`,
        }),
        step("koncentrace", {
          formula: `c = ${frac("m", "V")}`,
          substituted: `c = ${frac(`${tex(totalMg, 1)}${unit("mg")}`, `${tex(syringeMl, 0)}${unit("ml")}`)}`,
          result: `c = ${tex(concentration, 3)}${unit("mg/ml")}`,
        }),
        step("vzorec", {
          formula: `\\text{ml/h} = ${frac("D \\times m_{\\text{tělesná}} \\times 60", "c \\times 1000")}`,
        }),
        step("dosazeni", {
          substituted: `\\text{ml/h} = ${frac(`${tex(dose, 2)} \\times ${tex(weightKg, 0)} \\times 60`, `${tex(concentration, 3)} \\times 1000`)}`,
        }),
        step("vysledek", { result: `${tex(rate, 2)}${unit("ml/h")}` }),
      ],
      roundingNoteKey: "zaokrouhleniPumpa",
    };
  },

  answer: { unit: "mlPerHour", tolerance: tolerances.pumpRate(), decimals: 2 },
});
