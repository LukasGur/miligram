import { bodySurfaceArea } from "../formulas";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, weightForHeight } from "./helpers";
import { register } from "./registry";

const MOSTELLER = {
  citation: "Mosteller RD. Simplified calculation of body-surface area. N Engl J Med 1987;317(17):1098.",
  verifiedAt: "2026-09-02",
};

/**
 * C4 — o kolik procent se liší dávka dvou pacientů.
 *
 * Ukazuje, že dávka podle povrchu neroste s hmotností přímo úměrně:
 * pacient o dvacet kilo těžší nedostane o dvacet procent víc.
 * Odpověď je poměr, takže konkrétní mg/m² v zadání být nemusí.
 */
export const C4 = register({
  id: "C4",
  category: "povrch",
  source: MOSTELLER,

  generate(rng, difficulty) {
    const heightA = difficulty === 1 ? rng.step(160, 180, 10) : rng.step(150, 190, 1);
    const weightA = weightForHeight(rng, heightA, difficulty === 1 ? 10 : 1, { minKg: 50, maxKg: 90 });

    // Druhý pacient je vždy výrazně jiný, aby rozdíl nebyl v šumu.
    const heightB = difficulty === 1 ? heightA + 10 : heightA + rng.int(5, 25);
    const weightB = weightForHeight(rng, heightB, difficulty === 1 ? 10 : 1, { minKg: weightA + 10, maxKg: weightA + 40 });

    return { heightA, weightA, heightB, weightB } satisfies Vars;
  },

  solve(vars): Solution {
    const bsaA = bodySurfaceArea(Number(vars.heightA), Number(vars.weightA));
    const bsaB = bodySurfaceArea(Number(vars.heightB), Number(vars.weightB));
    const percent = (bsaB / bsaA - 1) * 100;

    return {
      value: percent,
      steps: [
        given(
          `A: ${q(Number(vars.heightA), "cm", 0)} / ${q(Number(vars.weightA), "kg", 0)}`,
          `B: ${q(Number(vars.heightB), "cm", 0)} / ${q(Number(vars.weightB), "kg", 0)}`,
        ),
        intermediate("povrchPrvni", { result: `BSA_A = ${q(bsaA, "m^2", 3)}` }),
        intermediate("povrchDruhy", { result: `BSA_B = ${q(bsaB, "m^2", 3)}` }),
        formula(`\\Delta = \\left( ${frac("BSA_B", "BSA_A")} - 1 \\right) \\times 100`),
        substitute(`\\Delta = \\left( ${frac(q(bsaB, "m^2", 3), q(bsaA, "m^2", 3))} - 1 \\right) \\times 100`),
        result(percent, "\\%", 1),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer: { unit: "percent", tolerance: { kind: "absolute", value: 0.5 }, decimals: 1 },
});
