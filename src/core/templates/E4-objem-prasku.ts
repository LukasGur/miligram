import { reconstitutedConcentration } from "../formulas";
import { productByCode } from "../products";
import { POWDER_VOLUMES, powderVolumeSource, type PowderVolume } from "../products/powderVolumes";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { register, SUKL_DLP } from "./registry";
import { adultDoseFor, adultDoseSource } from "../products/adultDoses";
import { dosingRule, dosingSource } from "../products/dosing";

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

/** Skutečná koncentrace po rozpuštění podle SPC. */
function realConcentration(item: PowderVolume): number {
  return item.approxMgPerMl ?? item.vialMg / item.finalMl!;
}

/**
 * Dávky, které se ze záznamu dají natáhnout: dospělé dávky ze SPC menší
 * než lahvička, u ceftriaxonu i.m. dětská dávka 50–80 mg/kg.
 */
function drawDoses(item: PowderVolume): number[] {
  const adult = (adultDoseFor(item.suklCode)?.singleMg ?? []).filter((mg) => mg < item.vialMg);
  if (item.suklCode !== "0121237") return [...adult];
  const range = dosingRule("ceftriaxonDeti").single!;
  const child: number[] = [];
  for (let mg = range.min * 5; mg < item.vialMg; mg += 50) child.push(Math.round(mg / 50) * 50);
  return [...new Set([...adult, ...child])];
}

const WITH_DOSE = POWDER_VOLUMES.filter((item) => drawDoses(item).length > 0);

function itemFor(vars: Vars): PowderVolume | undefined {
  if (vars.form === "draw") {
    return POWDER_VOLUMES.find(
      (item) => item.suklCode === String(vars.code) && item.diluentMl === Number(vars.diluentMl) && WITH_DOSE.includes(item),
    );
  }
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
    const sources = item ? [powderVolumeSource(item)] : [];
    if (vars.form !== "draw") return sources;
    // Odkud je dávka: dospělá z tabulky dávek, jinak dětská u ceftriaxonu.
    const adult = adultDoseFor(String(vars.code));
    const fromAdult = adult?.singleMg.includes(Number(vars.doseMg));
    return [...sources, fromAdult && adult ? adultDoseSource(adult) : dosingSource("ceftriaxonDeti")];
  },


  generate(rng, difficulty) {
    /**
     * Třetí podoba: kolik natáhnout pro dávku, když SPC uvádí skutečnou
     * koncentraci po rozpuštění. Právě kvůli tomu ten údaj v SPC stojí —
     * kdo počítá s objemem rozpouštědla, natáhne víc léku, než má.
     */
    const form =
      difficulty === 1
        ? "concentration"
        : difficulty === 2
          ? rng.pick(["concentration", "volume", "draw"] as const)
          : rng.pick(["volume", "draw"] as const);
    const item = rng.pick(form === "concentration" ? WITH_FINAL : form === "volume" ? WITH_CONCENTRATION : WITH_DOSE);
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
        : form === "volume"
          ? { approxMgPerMl: item.approxMgPerMl ?? 0 }
          : { approxMgPerMl: Number(realConcentration(item).toFixed(1)), doseMg: rng.pick(drawDoses(item)) }),
    } satisfies Vars;
  },

  solve(vars): Solution {
    const vialMg = Number(vars.vialMg);
    const diluentMl = Number(vars.diluentMl);

    if (vars.form === "draw") {
      const approx = Number(vars.approxMgPerMl);
      const doseMg = Number(vars.doseMg);
      const volumeMl = doseMg / approx;
      return {
        value: volumeMl,
        steps: [
          given(q(doseMg, "mg", 0), `c \\approx ${q(approx, "mg/ml", 1)}`),
          formula(`V = ${frac("\\text{@dose}", "c")}`),
          substitute(`V = ${frac(q(doseMg, "mg", 0), q(approx, "mg/ml", 1))}`),
          result(volumeMl, "ml", 2),
        ],
        roundingNoteKey: "zaokrouhleniStrikacka",
      };
    }

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
      unit: vars.form === "concentration" ? "mgPerMl" : "ml",
      tolerance,
      decimals: tolerances.decimalsFor(solution.value, tolerance),
    };
  },
});
