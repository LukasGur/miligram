import { concentrationOf, selectProducts } from "../products";
import { syringeFor } from "../devices";
import * as tolerances from "../tolerances";
import type { Solution, Source, Vars } from "../types";
import { formula, frac, given, intermediate, q, result, substitute } from "./helpers";
import { ISO_7886, register, SUKL_DLP } from "./registry";

/** Látky, které se registrují ve dvou silách sirupu a předepisují dětem. */
const SUBSTANCES = ["IBUPROFEN", "AZITHROMYCIN", "KLARITHROMYCIN"] as const;

const SPC_URL =
  "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics";

/**
 * Rozmezí jedné dětské dávky v mg. Předpis v zadání z něj vychází,
 * jinak by z „12,2 ml sirupu 40 mg/ml“ bylo 488 mg ibuprofenu naráz.
 * Dolní mez je nejmenší dítě, pro které SPC dávku uvádí, horní dítě
 * kolem 40 kg nebo strop ze SPC.
 */
const SINGLE_DOSE: Record<(typeof SUBSTANCES)[number], { minMg: number; maxMg: number; source: Source }> = {
  IBUPROFEN: {
    minMg: 50,
    maxMg: 400,
    source: {
      citation:
        "SÚKL, SPC přípravku Inflanor 20 mg/ml perorální suspenze, bod 4.2: „obvyklá denní dávka 20-30 mg/kg, " +
        "která se podává rozděleně do 3-4 dílčích dávek“; nejmenší dávka 2,5 ml (50 mg).",
      url: SPC_URL,
      suklCode: "0274535",
      verifiedAt: "2026-10-05",
    },
  },
  KLARITHROMYCIN: {
    minMg: 60,
    maxMg: 300,
    source: {
      citation:
        "SÚKL, SPC přípravku Klacid 125 mg/5 ml granule pro perorální suspenzi, bod 4.2: „Doporučená dávka " +
        "klarithromycinu pro kojence a děti od 6 měsíců do 12 let je 7,5 mg/kg dvakrát denně“ " +
        "(od 8 kg, u 40 kg 300 mg).",
      url: SPC_URL,
      suklCode: "0267343",
      verifiedAt: "2026-10-05",
    },
  },
  AZITHROMYCIN: {
    minMg: 50,
    maxMg: 500,
    source: {
      citation:
        "SÚKL, SPC přípravku Sumamed 20 mg/ml prášek pro perorální suspenzi, bod 4.2: 10 mg/kg/den, " +
        "nejvyšší jednotlivá dávka 500 mg jako u dospělých.",
      url: SPC_URL,
      suklCode: "0273525",
      verifiedAt: "2026-10-05",
    },
  },
};

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
  sourceFor: (vars) => [SINGLE_DOSE[vars.substance as (typeof SUBSTANCES)[number]].source],

  generate(rng, difficulty) {
    const pair = rng.pick(PAIRS);
    // Losuje se i směr — z slabšího na silnější i naopak.
    const fromStronger = rng.int(0, 1) === 1;
    const from = fromStronger ? pair.stronger : pair.weaker;
    const to = fromStronger ? pair.weaker : pair.stronger;

    // Předepsaný objem odpovídá dětské dávce, krok podle obtížnosti.
    const dose = SINGLE_DOSE[pair.substance];
    const fromConcentration = concentrationOf(from);
    const stepMl = difficulty === 1 ? 2.5 : difficulty === 2 ? 0.5 : 0.2;
    const minMl = Math.ceil(dose.minMg / fromConcentration / stepMl) * stepMl;
    const maxMl = Math.floor(dose.maxMg / fromConcentration / stepMl) * stepMl;
    const prescribedMl = Number(rng.step(minMl, maxMl, stepMl).toFixed(1));

    return {
      substance: pair.substance,
      fromName: from.name,
      fromCode: from.code,
      fromConcentration,
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
          substituted: `${q(prescribedMl, "ml", 1)} \\times ${q(fromConcentration, "mg/ml", 0)}`,
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
