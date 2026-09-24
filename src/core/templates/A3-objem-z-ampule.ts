import { doseVolume } from "../formulas";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { frac, step, tex, unit } from "./helpers";
import { doseSourceFor, dosedProducts, lessThanContent, pickDose, roundVolume } from "./ampouleDoses";
import { ISO_7886, register, SUKL_DLP } from "./registry";

/**
 * A3 — objem z ampule.
 *
 * Zadaná dávka je nižší než obsah ampule, takže se musí odměřit část.
 * Nejběžnější výpočet u lůžka a zároveň místo, kde se nejčastěji chybuje
 * o řád, když je síla uvedená v jiné jednotce než dávka.
 */
export const A3 = register({
  id: "A3",
  category: "zaklad",
  source: [SUKL_DLP, ISO_7886],

  sourceFor: doseSourceFor,

  generate(rng, difficulty) {
    /**
     * Ordinace je dávka pro dospělého ze SPC, menší než obsah ampule.
     * Na první úrovni vychází objem na desetiny mililitru, na třetí je
     * dávka v mikrogramech — proto jen dávky pod 10 mg, u větších by
     * zápis v µg působil uměle.
     */
    const { item, doseMg } = pickDose(rng, dosedProducts("ampoule"), (dose, candidate) =>
      lessThanContent(dose, candidate) &&
      (difficulty !== 1 || roundVolume(dose, candidate)) &&
      (difficulty !== 3 || dose < 10),
    );

    return {
      code: item.product.code,
      productName: item.product.name,
      substance: item.product.substance,
      strengthMg: item.contentMg,
      ampouleMl: item.contentMl,
      concentrationMgPerMl: item.concentrationMgPerMl,
      doseMg,
      // Na třetí úrovni je dávka zadaná v mikrogramech a je potřeba mezipřevod.
      doseUnit: difficulty === 3 ? "µg" : "mg",
      doseShown: difficulty === 3 ? Number((doseMg * 1000).toFixed(3)) : doseMg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseMg = Number(vars.doseMg);
    const strengthMg = Number(vars.strengthMg);
    const ampouleMl = Number(vars.ampouleMl);
    const volumeMl = doseVolume(doseMg, strengthMg, ampouleMl);

    const steps = [
      step("zadani", {
        result: `${tex(doseMg, 3)}${unit("mg")} \\;\\text{@of}\\; ${tex(strengthMg)}${unit("mg")} / ${tex(ampouleMl)}${unit("ml")}`,
      }),
      step("vzorec", {
        formula: `V = ${frac("\\text{@dose}", "\\text{@strength}")} \\times V_{\\text{@ampoule}}`,
      }),
      step("dosazeni", {
        substituted: `V = ${frac(`${tex(doseMg, 3)}${unit("mg")}`, `${tex(strengthMg)}${unit("mg")}`)} \\times ${tex(ampouleMl)}${unit("ml")}`,
      }),
      step("kraceni", {
        substituted: `V = ${tex(doseMg / strengthMg, 4)} \\times ${tex(ampouleMl)}${unit("ml")}`,
      }),
      step("vysledek", { result: `V = ${tex(volumeMl, 2)}${unit("ml")}` }),
    ];

    return { value: volumeMl, steps, roundingNoteKey: "zaokrouhleniStrikacka" };
  },

  answer(_vars, solution) {
    // Stříkačka určuje jak toleranci, tak počet zobrazených desetinných míst.
    const syringe = syringeFor(solution.value) ?? 50;
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(solution.value),
      decimals: syringe <= 2 ? 2 : 1,
    };
  },
});
