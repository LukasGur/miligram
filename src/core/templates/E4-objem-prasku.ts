import { reconstitutedConcentration } from "../formulas";
import { productByCode } from "../products";
import { POWDER_VOLUMES, powderVolumeSource, type PowderVolume } from "../products/powderVolumes";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";

/**
 * E4 — prášek zabírá objem.
 *
 * Výsledný objem není objem rozpouštědla: sám lyofilizát něco zabere,
 * takže koncentrace vyjde nižší, než by z prostého dělení vycházelo.
 * Čísla jsou z bodu 6.6 SPC (powderVolumes.ts), dřív se losovala.
 *
 * Dvě podoby podle toho, co SPC uvádí:
 *  - objem hotového roztoku → objem prášku je v zadání, počítá se
 *    skutečná koncentrace (první úroveň, na druhé napůl),
 *  - přibližná koncentrace → student zjistí, kolik místa prášek zabral.
 */
const WITH_FINAL = POWDER_VOLUMES.filter((item) => item.finalMl !== undefined);
const WITH_CONCENTRATION = POWDER_VOLUMES.filter((item) => item.approxMgPerMl !== undefined);

function itemFor(vars: Vars): PowderVolume | undefined {
  return POWDER_VOLUMES.find(
    (item) =>
      item.suklCode === String(vars.code) &&
      item.diluentMl === Number(vars.diluentMl) &&
      (vars.form === "volume" ? item.approxMgPerMl !== undefined : item.finalMl !== undefined),
  );
}

export const E4 = register({
  id: "E4",
  category: "rekonstituce",
  source: SUKL_DLP,

  sourceFor(vars) {
    const item = itemFor(vars);
    return item ? [powderVolumeSource(item)] : [];
  },

  generate(rng, difficulty) {
    const form =
      difficulty === 1 ? "concentration" : difficulty === 3 ? "volume" : rng.pick(["concentration", "volume"] as const);
    const item = rng.pick(form === "concentration" ? WITH_FINAL : WITH_CONCENTRATION);
    const product = productByCode(item.suklCode);

    return {
      form,
      code: item.suklCode,
      productName: product.name,
      substance: product.substance,
      vialMg: item.vialMg,
      diluentMl: item.diluentMl,
      ...(form === "concentration"
        ? { displacementMl: Number(((item.finalMl ?? item.diluentMl) - item.diluentMl).toFixed(2)) }
        : { approxMgPerMl: item.approxMgPerMl ?? 0 }),
    } satisfies Vars;
  },

  solve(vars): Solution {
    const vialMg = Number(vars.vialMg);
    const diluentMl = Number(vars.diluentMl);

    if (vars.form === "volume") {
      const approx = Number(vars.approxMgPerMl);
      const totalMl = vialMg / approx;
      const displacementMl = totalMl - diluentMl;
      return {
        value: displacementMl,
        steps: [
          given(q(vialMg, "mg", 0), q(diluentMl, "ml", 1), `c \\approx ${q(approx, "mg/ml", 0)}`),
          intermediate("celkovyObjem", {
            formula: `V_{\\text{@total}} = ${frac("m", "c")}`,
            substituted: `V_{\\text{@total}} = ${frac(q(vialMg, "mg", 0), q(approx, "mg/ml", 0))}`,
            result: q(totalMl, "ml", 3),
          }),
          formula(`V_{\\text{@powder}} = V_{\\text{@total}} - V_{\\text{@diluent}}`),
          substitute(`V_{\\text{@powder}} = ${q(totalMl, "ml", 3)} - ${q(diluentMl, "ml", 1)}`),
          result(displacementMl, "ml", 2),
        ],
        roundingNoteKey: "zaokrouhleniMezivysledek",
      };
    }

    const displacementMl = Number(vars.displacementMl);
    const totalMl = diluentMl + displacementMl;
    const concentration = reconstitutedConcentration(vialMg, diluentMl, displacementMl);

    return {
      value: concentration,
      steps: [
        given(q(vialMg, "mg", 0), q(diluentMl, "ml", 1), `V_{\\text{@powder}} = ${q(displacementMl, "ml", 1)}`),
        intermediate("celkovyObjem", {
          formula: `V_{\\text{@total}} = V_{\\text{@diluent}} + V_{\\text{@powder}}`,
          substituted: `V_{\\text{@total}} = ${q(diluentMl, "ml", 1)} + ${q(displacementMl, "ml", 1)}`,
          result: q(totalMl, "ml", 1),
        }),
        formula(`c = ${frac("m", "V_{\\text{@total}}")}`),
        substitute(`c = ${frac(q(vialMg, "mg", 0), q(totalMl, "ml", 1))}`),
        result(concentration, "mg/ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniMezivysledek",
    };
  },

  answer(vars, solution) {
    const tolerance = tolerances.intermediate();
    return {
      unit: vars.form === "volume" ? "ml" : "mgPerMl",
      tolerance,
      decimals: tolerances.decimalsFor(solution.value, tolerance),
    };
  },
});
