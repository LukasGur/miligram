import { microgramsPerKgMinToMlPerHour, microgramsPerMinToMlPerHour } from "../formulas";
import { concentrationOf, selectProducts, vialContentMg, type Product } from "../products";
import { dosingRule } from "../products/dosing";
import type { Rng } from "../random";

/** Objemy stříkaček do lineárního dávkovače. */
export const SYRINGE_VOLUMES_ML = [20, 50] as const;

/** Nejvíc, kolik ze stříkačky smí zabrat koncentrát; zbytek je ředidlo. */
const MAX_STOCK_SHARE = 0.6;

function vialVolume(product: Product): number {
  return product.packUnitVolumeMl ?? product.volumeMl ?? 1;
}

/** ATC skupiny látek, které se podávají kontinuálně v perfuzoru. */
export const VASOACTIVE_ATC = ["C01C", "C01D", "N01A", "N05C"] as const;

export type Dilution = {
  product: Product;
  /** Kolik ampulí se natáhne do stříkačky. */
  ampoules: number;
  syringeMl: number;
  totalMg: number;
  concentrationMgPerMl: number;
  /** Rychlost, která z tohoto ředění pro zadanou dávku vyjde. */
  rateMlPerHour: number;
  /**
   * Hotový roztok do perfuzoru (50 ml po 5 mg/ml dobutaminu): nic se
   * neředí, celé balení je obsah stříkačky.
   */
  premixed: boolean;
};

/**
 * Vybere ředění tak, aby pumpa běžela v rozumném rozsahu.
 *
 * V praxi se ředění nevolí nezávisle na dávce: u příliš zředěného roztoku
 * vycházejí stovky ml/h, které dávkovač neumí nastavit a pacient by je
 * neunesl. Ze všech proveditelných kombinací proto losujeme přípravek
 * a v rámci něj bereme tu, která míří nejblíž k deseti mililitrům za hodinu.
 */
export function choosePerfusorDilution(
  rng: Rng,
  dose: { perKgMin: number; weightKg: number } | { perMin: number },
  options: {
    /**
     * Kódy SÚKL přípravků, ke kterým dávka patří. Povinné: dřív se k dávce
     * dopaminu nebo noradrenalinu losoval jakýkoli lék z perfuzoru a
     * vycházelo třeba 10 µg/kg/min levosimendanu, padesátkrát víc, než
     * připouští jeho SPC.
     */
    codes: readonly string[];
    minRate?: number;
    maxRate?: number;
    ampouleCounts?: readonly number[];
  },
): Dilution {
  const { codes, minRate = 0.5, maxRate = 60, ampouleCounts = [1, 2, 3, 4] } = options;

  const rateFor = (concentration: number) =>
    "perKgMin" in dose
      ? microgramsPerKgMinToMlPerHour(dose.perKgMin, dose.weightKg, concentration)
      : microgramsPerMinToMlPerHour(dose.perMin, concentration);

  const products = selectProducts({
    kind: "concentrate",
    strengthUnit: "mg",
    atcPrefixes: VASOACTIVE_ATC,
  }).filter((product) => codes.includes(product.code));

  /**
   * Hotové roztoky do perfuzoru. Na JIP se stříkačka často neředí, ale
   * natáhne celá z lahvičky 50 ml — obsah stříkačky je obsah balení.
   */
  const premixed = selectProducts({ kind: "infusionBag", strengthUnit: "mg", atcPrefixes: VASOACTIVE_ATC })
    .filter((product) => codes.includes(product.code) && product.packUnitVolumeMl !== undefined)
    .map((product) => {
      const syringeMl = product.packUnitVolumeMl!;
      const totalMg = Number((concentrationOf(product) * syringeMl).toPrecision(12));
      const concentrationMgPerMl = totalMg / syringeMl;
      return {
        product,
        ampoules: 1,
        syringeMl,
        totalMg,
        concentrationMgPerMl,
        rateMlPerHour: rateFor(concentrationMgPerMl),
        premixed: true,
      };
    });

  const candidates = [...premixed, ...products.flatMap((product) =>
    SYRINGE_VOLUMES_ML.flatMap((syringeMl) =>
      // Ampule se musí vejít do stříkačky i s ředidlem.
      ampouleCounts.filter((ampoules) => ampoules * vialVolume(product) <= syringeMl * MAX_STOCK_SHARE).map((ampoules) => {
        /**
         * Obsah ampule krát počet ampulí nechává v plovoucí čárce zbytky:
         * 0,2 mg × 3 vyjde 0,6000000000000001. Zadání pak ukazuje jiné
         * číslo, než se kterým se počítá, tak se to hned ořízne.
         */
        const totalMg = Number((vialContentMg(product) * ampoules).toPrecision(12));
        const concentrationMgPerMl = totalMg / syringeMl;
        return {
          product,
          ampoules,
          syringeMl,
          totalMg,
          concentrationMgPerMl,
          rateMlPerHour: rateFor(concentrationMgPerMl),
          premixed: false,
        };
      }),
    ),
  )].filter((option) => option.rateMlPerHour >= minRate && option.rateMlPerHour <= maxRate);

  if (candidates.length === 0) {
    throw new Error("Pro zadanou dávku nevychází žádné ředění v rozsahu pumpy.");
  }

  const product = rng.pick([...new Set(candidates.map((option) => option.product))]);
  return candidates
    .filter((option) => option.product === product)
    .reduce((best, option) =>
      Math.abs(Math.log(option.rateMlPerHour / 10)) < Math.abs(Math.log(best.rateMlPerHour / 10))
        ? option
        : best,
    );
}

/**
 * Kódy SÚKL přípravků, ke kterým patří dávkovací pravidlo. Koncentráty
 * k ředění (G4, G6 chystají stříkačku) a k tomu hotové roztoky téže látky
 * pro úlohy na rychlost.
 */
export const NORADRENALINE_CODES = [dosingRule("noradrenalin").suklCode] as const;
export const DOPAMINE_CODES = [dosingRule("dopamin").suklCode] as const;
/** Norepinephrine hameln 0,2 mg/ml, hotový roztok do perfuzoru po 50 ml (DLP). */
export const NORADRENALINE_RATE_CODES = [...NORADRENALINE_CODES, "0245944"] as const;

/**
 * Látky dávkované v µg/kg/min pro G2, G3 a G5: dopamin z koncentrátu
 * a dobutamin z hotového roztoku 5 mg/ml. Obě SPC uvádějí 2–20 µg/kg/min.
 */
export const PER_KG_RULES = ["dopamin", "dobutamin"] as const;
export type PerKgRule = (typeof PER_KG_RULES)[number];
export const PER_KG_CODES: Record<PerKgRule, readonly string[]> = {
  dopamin: DOPAMINE_CODES,
  dobutamin: [dosingRule("dobutamin").suklCode],
};

/**
 * Ředění, jaké se na oddělení opravdu chystá: přípravek s ověřeným
 * dávkováním a počet ampulí, při kterém pumpa u dávky z rozmezí SPC běží
 * v rozumných mezích. Pro úlohy na přípravu stříkačky (G4, G6), které
 * samy dávku neřeší — dřív v nich vycházelo 1 200 mg dopaminu v 50 ml.
 */
export function realisticDilution(rng: Rng): Dilution {
  if (rng.pick([true, false])) {
    const range = dosingRule("noradrenalin").single!;
    return choosePerfusorDilution(rng, { perMin: rng.step(range.min, range.max, 1) }, { codes: NORADRENALINE_CODES });
  }
  const range = dosingRule("dopamin").single!;
  return choosePerfusorDilution(
    rng,
    { perKgMin: rng.step(range.min, range.max, 1), weightKg: rng.step(50, 95, 5) },
    { codes: DOPAMINE_CODES },
  );
}
