import { doseVolume } from "../formulas";
import { syringeFor } from "../devices";
import { doseSourceFor, dosedProducts, pickDose, roundVolume } from "./ampouleDoses";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * A2 — objem perorální suspenze z dávky v mg.
 *
 * Sirup se dávkuje odměrkou nebo stříkačkou, takže výsledek musí padnout
 * do objemu, který jde reálně odměřit. Dávka se proto losuje jako podíl
 * obsahu jednoho balení, ne jako volné číslo.
 */
export const A2 = register({
  id: "A2",
  category: "zaklad",
  source: SUKL_DLP,

  sourceFor: doseSourceFor,

  generate(rng, difficulty) {
    /**
     * Dávka pro dospělého ze SPC roztoku. Dřív se dávka dopočítala
     * z náhodného objemu až 15 ml, a z kapek, kde je v mililitru 100 mg
     * tramadolu nebo 500 mg metamizolu, vycházely gramy. Na první úrovni
     * vychází objem na půl mililitru, výš na desetiny.
     */
    const { item, doseMg } = pickDose(rng, dosedProducts("oralLiquid"), (dose, candidate) =>
      roundVolume(dose, candidate, difficulty === 1 ? 0.5 : 0.1) &&
      Math.abs(dose - candidate.contentMg) > 1e-9,
    );

    return {
      code: item.product.code,
      productName: item.product.name,
      // Léková forma z DLP: suspenze se jako roztok vydávat nesmí.
      liquidForm: item.product.form.includes("SUS") ? "suspension" : "solution",
      substance: item.product.substance,
      strengthMg: item.contentMg,
      referenceMl: item.contentMl,
      concentrationMgPerMl: item.concentrationMgPerMl,
      doseMg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseMg = Number(vars.doseMg);
    const strengthMg = Number(vars.strengthMg);
    const referenceMl = Number(vars.referenceMl);
    const volumeMl = doseVolume(doseMg, strengthMg, referenceMl);

    return {
      value: volumeMl,
      steps: [
        given(q(doseMg, "mg", 3), `${q(strengthMg, "mg")} / ${q(referenceMl, "ml", 0)}`),
        formula(`V = ${frac("\\text{@dose}", "\\text{@strength}")} \\times V_{\\text{ref}}`),
        substitute(`V = ${frac(q(doseMg, "mg", 3), q(strengthMg, "mg"))} \\times ${q(referenceMl, "ml", 0)}`),
        result(volumeMl, "ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(solution.value),
      decimals: (syringeFor(solution.value) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
