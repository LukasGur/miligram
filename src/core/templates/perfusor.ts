import { microgramsPerKgMinToMlPerHour, microgramsPerMinToMlPerHour } from "../formulas";
import { selectProducts, vialContentMg, type Product } from "../products";
import type { Rng } from "../random";

/** Objemy stříkaček do lineárního dávkovače. */
export const SYRINGE_VOLUMES_ML = [20, 50] as const;

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
  options: { minRate?: number; maxRate?: number; ampouleCounts?: readonly number[] } = {},
): Dilution {
  const { minRate = 0.5, maxRate = 60, ampouleCounts = [1, 2, 3, 4] } = options;

  const rateFor = (concentration: number) =>
    "perKgMin" in dose
      ? microgramsPerKgMinToMlPerHour(dose.perKgMin, dose.weightKg, concentration)
      : microgramsPerMinToMlPerHour(dose.perMin, concentration);

  const candidates = selectProducts({
    kind: "concentrate",
    strengthUnit: "mg",
    atcPrefixes: VASOACTIVE_ATC,
  }).flatMap((product) =>
    SYRINGE_VOLUMES_ML.flatMap((syringeMl) =>
      ampouleCounts.map((ampoules) => {
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
        };
      }),
    ),
  ).filter((option) => option.rateMlPerHour >= minRate && option.rateMlPerHour <= maxRate);

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
