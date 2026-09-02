import { doseVolume } from "../formulas";
import { concentrationOf, pickProduct } from "../products";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { frac, step, tex, unit } from "./helpers";
import { register } from "./registry";

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
  source: [
    {
      citation: "SÚKL, Databáze léčivých přípravků, vydání 27. 8. 2026 — síla a balení přípravku.",
      url: "https://opendata.sukl.cz/?q=katalog/databaze-lecivych-pripravku-dlp",
      verifiedAt: "2026-09-02",
    },
    {
      citation: "ČSN EN ISO 7886-1 — tolerance odměřeného objemu stříkačkou.",
      url: "https://www.iso.org/standard/14835.html",
      verifiedAt: "2026-09-03",
    },
  ],

  generate(rng, difficulty) {
    const product = pickProduct(rng, {
      kind: "ampoule",
      strengthUnit: "mg",
      minStrength: 1,
      maxStrength: 1000,
      maxVolumeMl: 20,
    });
    const concentration = concentrationOf(product);

    /**
     * Dávka se losuje jako podíl obsahu ampule, ne jako absolutní číslo:
     * u ampule 2 mg/2 ml a u ampule 500 mg/10 ml vypadá „rozumná dávka“
     * úplně jinak. Na první úrovni vychází kulatý objem, na dalších ne.
     */
    const fraction = difficulty === 1
      ? rng.pick([0.25, 0.5, 0.75] as const)
      : rng.step(0.2, 0.9, 0.05);

    const doseMg = Number((product.strength * fraction).toPrecision(3));

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      strengthMg: product.strength,
      ampouleMl: product.volumeMl ?? 1,
      concentrationMgPerMl: concentration,
      doseMg,
      // Na třetí úrovni je dávka zadaná v mikrogramech a je potřeba mezipřevod.
      doseUnit: difficulty === 3 ? "µg" : "mg",
      doseShown: difficulty === 3 ? doseMg * 1000 : doseMg,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const doseMg = Number(vars.doseMg);
    const strengthMg = Number(vars.strengthMg);
    const ampouleMl = Number(vars.ampouleMl);
    const volumeMl = doseVolume(doseMg, strengthMg, ampouleMl);

    const steps = [
      step("zadani", {
        result: `${tex(doseMg, 3)}${unit("mg")} \;\\text{z}\; ${tex(strengthMg)}${unit("mg")} / ${tex(ampouleMl)}${unit("ml")}`,
      }),
      step("vzorec", {
        formula: `V = ${frac("\\text{dávka}", "\\text{síla}")} \\times V_{\\text{ampule}}`,
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
