import { dropsPerMinute } from "../formulas";
import { DROP_FACTORS, DROP_FACTOR_SOURCE } from "../devices";
import { CARRIER_SOURCE, pickCarrier } from "../products/carriers";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { frac, q, step, tex, unit } from "./helpers";
import { register } from "./registry";

/**
 * F2 — kapky za minutu.
 *
 * Gravitační infuze bez pumpy. Kapkový faktor je vlastnost setu, ne léku,
 * a je proto v zadání uvedený — student ho nemá odkud odvodit.
 */
export const F2 = register({
  id: "F2",
  category: "infuze",
  source: [CARRIER_SOURCE, DROP_FACTOR_SOURCE],

  generate(rng, difficulty) {
    const product = pickCarrier(rng);
    const bagMl = product.packUnitVolumeMl ?? 500;

    // Faktor 60 je mikrokapkový set; na první úrovni se nelosuje,
    // protože u něj počet kapek splývá s ml/h a příklad ztratí smysl.
    const dropFactor = difficulty === 1
      ? rng.pick([20, 15] as const)
      : rng.pick(DROP_FACTORS);

    const hours = difficulty === 1
      ? rng.pick([2, 4, 6, 8, 12] as const)
      : rng.step(1, 12, 0.5);

    return {
      code: product.code,
      productName: product.name,
      substance: product.substance,
      bagMl,
      dropFactor,
      hours,
      // Na třetí úrovni je čas zadaný v minutách, takže odpadá krok převodu.
      timeUnit: difficulty === 3 ? "min" : "h",
      timeShown: difficulty === 3 ? hours * 60 : hours,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const bagMl = Number(vars.bagMl);
    const dropFactor = Number(vars.dropFactor);
    const minutes = Number(vars.hours) * 60;
    const drops = dropsPerMinute(bagMl, dropFactor, minutes);

    return {
      value: drops,
      steps: [
        step("zadani", {
          result: `${tex(bagMl, 0)}${unit("ml")} \\;/\\; ${tex(minutes, 0)}${unit("min")} \\;/\\; ${tex(dropFactor, 0)}${unit("gtt/ml")}`,
        }),
        step("vzorec", {
          formula: `\\text{gtt/min} = ${frac("V \\times \\text{@dropFactor}", "t")}`,
        }),
        step("dosazeni", {
          substituted: `\\text{gtt/min} = ${frac(`${q(bagMl, "ml", 0)} \\times ${q(dropFactor, "gtt/ml", 0)}`, q(minutes, "min", 0))}`,
        }),
        step("vysledek", { result: `${tex(drops, 1)}${unit("gtt/min")}` }),
      ],
      roundingNoteKey: "zaokrouhleniKapky",
    };
  },

  answer: { unit: "dropsPerMinute", tolerance: tolerances.drops(), decimals: 0 },
});
