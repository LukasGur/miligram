import { doseVolume, reconstitutedConcentration } from "../formulas";
import { pickProduct } from "../products";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { frac, step, tex, unit } from "./helpers";
import { ISO_7886, register, SUKL_DLP } from "./registry";

/** Objemy rozpouštědla, které SPC lyofilizátů uvádějí nejčastěji. */
const DILUENT_VOLUMES_ML = [5, 10, 20] as const;

/**
 * E1 — rekonstituce lyofilizátu.
 *
 * Dva kroky: z množství látky a objemu rozpouštědla vyjde koncentrace,
 * z ní teprve objem pro předepsanou dávku. Objem rozpouštědla je v zadání,
 * protože se liší přípravek od přípravku a patří do SPC, ne do hlavy.
 */
export const E1 = register({
  id: "E1",
  category: "rekonstituce",
  source: [SUKL_DLP, ISO_7886],

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "powderVial",
      strengthUnit: "mg",
      minStrength: 100,
      maxStrength: 2000,
    });
    const diluentMl = rng.pick(DILUENT_VOLUMES_ML);

    /**
     * Celá lahvička se nepodává nikdy: rozpuštěný objem je v zadání, takže
     * by odpověď byla opsané číslo. Na první úrovni proto aspoň polovina
     * nebo čtvrtina — dělení hezkým číslem, ale pořád dělení.
     */
    const fraction = difficulty === 1 ? rng.pick([0.25, 0.5, 0.75]) : rng.step(0.25, 0.9, 0.05);
    const doseMg = Number((product.strength * fraction).toPrecision(3));

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      vialMg: product.strength,
      diluentMl,
      doseMg,
      doseUnit: difficulty === 3 ? "g" : "mg",
      doseShown: difficulty === 3 ? doseMg / 1000 : doseMg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const vialMg = Number(vars.vialMg);
    const diluentMl = Number(vars.diluentMl);
    const doseMg = Number(vars.doseMg);

    const concentration = reconstitutedConcentration(vialMg, diluentMl, 0);
    const volumeMl = doseVolume(doseMg, vialMg, diluentMl);

    return {
      value: volumeMl,
      steps: [
        step("zadani", {
          result: `${tex(vialMg, 0)}${unit("mg")} + ${tex(diluentMl, 0)}${unit("ml")},\\; \\text{@dose } ${tex(doseMg, 3)}${unit("mg")}`,
        }),
        step("koncentrace", {
          formula: `c = ${frac("m_{\\text{@vial}}", "V_{\\text{@diluent}}")}`,
          substituted: `c = ${frac(`${tex(vialMg, 0)}${unit("mg")}`, `${tex(diluentMl, 0)}${unit("ml")}`)}`,
          result: `${tex(concentration, 2)}${unit("mg/ml")}`,
        }),
        step("objem", {
          formula: `V = ${frac("\\text{@dose}", "c")}`,
          substituted: `V = ${frac(`${tex(doseMg, 3)}${unit("mg")}`, `${tex(concentration, 2)}${unit("mg/ml")}`)}`,
        }),
        step("vysledek", { result: `V = ${tex(volumeMl, 2)}${unit("ml")}` }),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    const syringe = syringeFor(solution.value) ?? 50;
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(solution.value),
      decimals: syringe <= 2 ? 2 : 1,
    };
  },
});
