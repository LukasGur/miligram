import { concentrationOf, selectProducts } from "../products";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute, tex } from "./helpers";
import { ISO_7886, register, SUKL_DLP } from "./registry";

/** Látky, které se registrují ve dvou silách sirupu a předepisují dětem. */
const SUBSTANCES = ["IBUPROFEN", "AZITHROMYCIN", "KLARITHROMYCIN"] as const;

/**
 * Dvojice sil téže látky. Sestavuje se z fondu, ne ze seznamu v kódu —
 * kdyby některá síla z registrace vypadla, dvojice zmizí sama.
 */
const PAIRS = SUBSTANCES.flatMap((substance) => {
  const byConcentration = new Map<number, ReturnType<typeof selectProducts>[number]>();
  for (const product of selectProducts({ kind: "oralLiquid", strengthUnit: "mg" })) {
    if (product.substance !== substance || product.volumeMl === undefined) continue;
    byConcentration.set(concentrationOf(product), product);
  }
  const sorted = [...byConcentration.entries()].sort((a, b) => a[0] - b[0]);
  return sorted.length >= 2 ? [{ substance, weaker: sorted[0][1], stronger: sorted.at(-1)![1] }] : [];
});

/**
 * K6 — doma mají jinou sílu, než na kterou je předpis.
 *
 * Sirup téže látky se registruje ve dvou koncentracích a v lékárně
 * vydají tu, kterou mají. Objem se pak musí přepočítat: dávka v mg
 * zůstává, mění se jen to, v kolika mililitrech je. Kdo přepočet
 * neudělá, podá dvojnásobek nebo polovinu.
 */
export const K6 = register({
  id: "K6",
  category: "pediatrie",
  source: [SUKL_DLP, ISO_7886],

  generate(rng, difficulty) {
    const pair = rng.pick(PAIRS);
    // Losuje se i směr — z slabšího na silnější i naopak.
    const fromStronger = rng.int(0, 1) === 1;
    const from = fromStronger ? pair.stronger : pair.weaker;
    const to = fromStronger ? pair.weaker : pair.stronger;

    const prescribedMl = difficulty === 1
      ? rng.step(2.5, 10, 2.5)
      : difficulty === 2
        ? rng.step(1, 12, 0.5)
        : rng.step(1.2, 14.4, 0.2);

    return {
      substance: pair.substance,
      fromName: from.name,
      fromCode: from.code,
      fromConcentration: concentrationOf(from),
      toName: to.name,
      toCode: to.code,
      toConcentration: concentrationOf(to),
      prescribedMl,
    } satisfies Vars;
  },

  solve(vars): Solution {
    const prescribedMl = Number(vars.prescribedMl);
    const fromConcentration = Number(vars.fromConcentration);
    const toConcentration = Number(vars.toConcentration);

    const doseMg = prescribedMl * fromConcentration;
    const volumeMl = doseMg / toConcentration;

    return {
      value: volumeMl,
      steps: [
        given(q(prescribedMl, "ml", 1), q(fromConcentration, "mg/ml", 0), q(toConcentration, "mg/ml", 0)),
        intermediate("davkaVMg", {
          substituted: `${tex(prescribedMl, 1)} \\times ${tex(fromConcentration, 0)}`,
          result: q(doseMg, "mg", 1),
        }),
        formula(`V = ${frac("\\text{@dose}", "\\text{@newConcentration}")}`),
        substitute(`V = ${frac(q(doseMg, "mg", 1), q(toConcentration, "mg/ml", 0))}`),
        result(volumeMl, "ml", 1),
      ],
      roundingNoteKey: "zaokrouhleniStrikacka",
    };
  },

  answer(_vars, solution) {
    return {
      unit: "ml",
      tolerance: tolerances.syringeVolume(Math.min(solution.value, 50)),
      decimals: (syringeFor(Math.min(solution.value, 50)) ?? 50) <= 2 ? 2 : 1,
    };
  },
});
