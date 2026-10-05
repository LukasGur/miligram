import { adultDoseFor, adultDoseSource, type AdultDose } from "../products/adultDoses";
import { concentrationOf, selectProducts, vialContentMg, type Product, type ProductKind } from "../products";
import type { Rng } from "../random";
import type { Source, Vars } from "../types";

/**
 * Přípravek s ověřenou dávkou pro dospělého — podklad pro základní úlohy
 * (A1 až A8, E1, E5). Ordinace v zadání se nelosuje jako násobek balení,
 * ale bere se z dávek, které uvádí SPC.
 */
export type DosedProduct = {
  product: Product;
  dose: AdultDose;
  /**
   * Obsah jedné ampule v mg. U perorálních roztoků obsah referenčního
   * objemu, u tablety a lahvičky s práškem obsah jednoho kusu.
   */
  contentMg: number;
  /** Objem jedné ampule v ml. U perorálních roztoků referenční objem, u tablety a prášku 0. */
  contentMl: number;
  /** U tablety a prášku 0 — koncentrace vzniká až rozpuštěním. */
  concentrationMgPerMl: number;
};

const EPS = 1e-9;

export function dosedProducts(
  kind: Extract<ProductKind, "ampoule" | "oralLiquid" | "tablet" | "powderVial">,
): DosedProduct[] {
  return selectProducts({ kind, strengthUnit: "mg" }).flatMap((product) => {
    const dose = adultDoseFor(product.code);
    if (!dose) return [];
    if (kind === "tablet" || kind === "powderVial") {
      return [{ product, dose, contentMg: product.strength, contentMl: 0, concentrationMgPerMl: 0 }];
    }
    if (kind === "oralLiquid") {
      return [{
        product,
        dose,
        contentMg: product.strength,
        contentMl: product.volumeMl ?? 1,
        concentrationMgPerMl: concentrationOf(product),
      }];
    }
    // Bez objemu ampule z DLP nejde říct, kolik v ní je — takový přípravek se nepoužije.
    if (product.packUnitVolumeMl === undefined) return [];
    return [{
      product,
      dose,
      contentMg: vialContentMg(product),
      contentMl: product.packUnitVolumeMl,
      concentrationMgPerMl: concentrationOf(product),
    }];
  });
}

/**
 * Vylosuje přípravek a dávku, která splňuje podmínku úlohy. Nejdřív se
 * losuje přípravek, pak dávka — jinak by přípravky s mnoha uvedenými
 * dávkami vycházely častěji než ostatní.
 */
export function pickDose(
  rng: Rng,
  candidates: readonly DosedProduct[],
  allowed: (doseMg: number, item: DosedProduct) => boolean,
): { item: DosedProduct; doseMg: number } {
  const options = candidates
    .map((item) => ({ item, doses: item.dose.singleMg.filter((d) => allowed(d, item)) }))
    .filter((option) => option.doses.length > 0);
  if (options.length === 0) throw new Error("Žádný přípravek nemá dávku, která by úloze vyhovovala.");
  const { item, doses } = rng.pick(options);
  return { item, doseMg: rng.pick(doses) };
}

/** Dávka menší než obsah ampule — odměřuje se jen část. */
export const lessThanContent = (doseMg: number, item: DosedProduct) => doseMg < item.contentMg - EPS;

/** Dávka větší než obsah jedné ampule. */
export const moreThanContent = (doseMg: number, item: DosedProduct) => doseMg > item.contentMg + EPS;

/** Objem pro dávku vychází na desetiny mililitru. */
export function roundVolume(doseMg: number, item: DosedProduct, step = 0.1): boolean {
  const volume = doseMg / item.concentrationMgPerMl;
  const units = volume / step;
  return Math.abs(units - Math.round(units)) < 1e-6;
}

/** Citace SPC přípravku, ze kterého pochází dávka v zadání. */
export function doseSourceFor(vars: Vars): Source[] {
  const dose = adultDoseFor(String(vars.code));
  return dose ? [adultDoseSource(dose)] : [];
}

/**
 * Počet tablet, který se dá podat: celé tablety, půlka jen u tablety,
 * kterou podle SPC lze rozdělit na stejné dávky, a nejvýš čtyři kusy.
 */
export function tabletCount(doseMg: number, item: DosedProduct): number | null {
  const count = doseMg / item.contentMg;
  const halves = count * 2;
  if (Math.abs(halves - Math.round(halves)) > 1e-6 || count > 4 + EPS) return null;
  const whole = Math.abs(count - Math.round(count)) < 1e-6;
  if (!whole && !item.dose.divisibleQuote) return null;
  return Math.round(halves) / 2;
}
