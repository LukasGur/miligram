import { bodySurfaceArea } from "../formulas";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { register } from "./registry";

const MOSTELLER = {
  citation: "Mosteller RD. Simplified calculation of body-surface area. N Engl J Med 1987;317(17):1098.",
  verifiedAt: "2026-09-02",
};

/**
 * C1 — povrch těla podle Mostellera.
 *
 * Samotný vzorec, bez přípravku. Je to předstupeň k onkologickému
 * dávkování a stojí za to ho procvičit odděleně — odmocnina je jediné
 * místo v aplikaci, kde se počítá něco jiného než násobení a dělení.
 */
export const C1 = register({
  id: "C1",
  category: "povrch",
  source: MOSTELLER,

  generate(rng, difficulty) {
    // Rozsahy pokrývají dospělé i větší děti; L1 dává kulaté hodnoty.
    const heightCm = difficulty === 1 ? rng.step(150, 190, 10) : rng.step(110, 195, 1);
    const weightKg = difficulty === 1 ? rng.step(50, 90, 10) : rng.step(20, 120, 1);

    return {
      heightCm,
      weightKg,
      // Na třetí úrovni je výška zadaná v metrech.
      heightUnit: difficulty === 3 ? "m" : "cm",
      heightShown: difficulty === 3 ? heightCm / 100 : heightCm,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const heightCm = Number(vars.heightCm);
    const weightKg = Number(vars.weightKg);
    const product = heightCm * weightKg;
    const bsa = bodySurfaceArea(heightCm, weightKg);

    return {
      value: bsa,
      steps: [
        given(q(heightCm, "cm", 0), q(weightKg, "kg", 0)),
        formula(`BSA = \\sqrt{${frac("v \\times m", "3600")}}`),
        substitute(`BSA = \\sqrt{${frac(`${q(heightCm, "", 0)} \\times ${q(weightKg, "", 0)}`, "3600")}}`),
        substitute(`BSA = \\sqrt{${q(product / 3600, "", 4)}}`),
        result(bsa, "m^2", 2),
      ],
      roundingNoteKey: "zaokrouhleniPovrch",
    };
  },

  answer: { unit: "m2", tolerance: { kind: "decimals", places: 2 }, decimals: 2 },
});
