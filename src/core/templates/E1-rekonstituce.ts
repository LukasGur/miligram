import { doseVolume, reconstitutedConcentration } from "../formulas";
import { doseSourceFor, dosedProducts, lessThanContent, pickDose } from "./ampouleDoses";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { frac, step, tex, unit } from "./helpers";
import { ISO_7886, register, SUKL_DLP } from "./registry";
import { dosingRule, dosingSource } from "../products/dosing";

/** Objemy rozpouštědla, které SPC lyofilizátů uvádějí nejčastěji. */

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

  // Dětská dávka cituje dávkování ceftriaxonu u dětí, dospělá tabulku dávek.
  sourceFor: (vars) => [...doseSourceFor(vars), ...(vars.child === "yes" ? [dosingSource("ceftriaxonDeti")] : [])],

  generate(rng, difficulty) {
    /**
     * Dávka i objem rozpouštědla ze SPC. Dřív se rozpouštědlo losovalo
     * z 5, 10 a 20 ml a dávka byla zlomek lahvičky — 188 mg cefuroximu
     * nikdo neordinuje. Teď jen lahvičky, u kterých bod 6.6 uvádí objem
     * i výslednou koncentraci, a dávka menší než obsah lahvičky.
     */
    const candidates = dosedProducts("powderVial").filter((candidate) => candidate.dose.reconstitution);

    /**
     * U dětí se z lahvičky natahuje jen část: ceftriaxon 50–80 mg/kg
     * podle SPC, ordinovaný v mg na padesátky. Dospělé dávky ze SPC bývají
     * celá lahvička nebo víc, a tak by úloha znala jen pár kombinací.
     */
    const ceftriaxone = candidates.filter((candidate) => candidate.product.substance === "CEFTRIAXON");
    const child = ceftriaxone.length > 0 && rng.pick([true, false]);
    let item: (typeof candidates)[number];
    let doseMg: number;
    if (child) {
      const rule = dosingRule("ceftriaxonDeti");
      const range = rule.single!;
      item = rng.pick(ceftriaxone);
      const weightKg = rng.step(5, 30, 0.5);
      const raw = rng.step(range.min, range.max, 5) * weightKg;
      doseMg = Math.min(Math.round(raw / 50) * 50, item.contentMg - 50);
    } else {
      ({ item, doseMg } = pickDose(rng, candidates, lessThanContent));
    }

    return {
      code: item.product.code,
      productName: item.product.name,
      substance: item.product.substance,
      vialMg: item.contentMg,
      diluentMl: item.dose.reconstitution?.diluentMl ?? 10,
      doseMg,
      doseUnit: difficulty === 3 ? "g" : "mg",
      doseShown: difficulty === 3 ? doseMg / 1000 : doseMg,
      child: child ? "yes" : "no",
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
