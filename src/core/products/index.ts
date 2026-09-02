import type { Rng } from "../random";
import { PRODUCTS, DLP_RELEASE } from "./pool.generated";
import type { Product, ProductKind } from "./types";

export { PRODUCTS, DLP_RELEASE };
export type { Product, ProductKind };

export type ProductFilter = {
  kind: ProductKind;
  /** Jen přípravky v mg, nebo jen v mezinárodních jednotkách. */
  strengthUnit?: Product["strengthUnit"];
  /** Rozsah obsahu účinné látky v mg, respektive IU. */
  minStrength?: number;
  maxStrength?: number;
  /** Rozsah objemu, ve kterém je síla uvedená. */
  minVolumeMl?: number;
  maxVolumeMl?: number;
  /** Omezení na konkrétní ATC skupiny, například ["J01"] pro antibiotika. */
  atcPrefixes?: readonly string[];
  /** Vyloučení konkrétních přípravků podle kódu SÚKL. */
  excludeCodes?: readonly string[];
};

export function selectProducts(filter: ProductFilter): Product[] {
  return PRODUCTS.filter((product) => {
    if (product.kind !== filter.kind) return false;
    if (filter.strengthUnit && product.strengthUnit !== filter.strengthUnit) return false;
    if (filter.minStrength !== undefined && product.strength < filter.minStrength) return false;
    if (filter.maxStrength !== undefined && product.strength > filter.maxStrength) return false;

    if (filter.minVolumeMl !== undefined || filter.maxVolumeMl !== undefined) {
      if (product.volumeMl === undefined) return false;
      if (filter.minVolumeMl !== undefined && product.volumeMl < filter.minVolumeMl) return false;
      if (filter.maxVolumeMl !== undefined && product.volumeMl > filter.maxVolumeMl) return false;
    }

    if (filter.atcPrefixes && !filter.atcPrefixes.some((p) => product.atc.startsWith(p))) return false;
    if (filter.excludeCodes?.includes(product.code)) return false;
    return true;
  });
}

/**
 * Vylosuje přípravek pro zadání. Prázdný výsledek je chyba šablony,
 * ne stav, se kterým by se dalo pokračovat — příklad bez léku neexistuje.
 */
export function pickProduct(rng: Rng, filter: ProductFilter): Product {
  const matches = selectProducts(filter);
  if (matches.length === 0) {
    throw new Error(`Fond neobsahuje žádný přípravek pro filtr ${JSON.stringify(filter)}.`);
  }
  return rng.pick(matches);
}

/** Koncentrace přípravku v mg/ml, respektive IU/ml. Jen tam, kde dává smysl. */
export function concentrationOf(product: Product): number {
  if (product.volumeMl === undefined) {
    throw new Error(`${product.name} nemá uvedený objem, koncentraci z něj spočítat nelze.`);
  }
  return product.strength / product.volumeMl;
}

/**
 * Obsah účinné látky v jedné lahvičce nebo ampuli.
 *
 * DLP zapisuje sílu dvěma způsoby: buď jako celkový obsah („80MG/2ML“),
 * nebo jako koncentraci („1MG/ML“). V druhém případě je skutečný obsah
 * až v balení — Asicord 1 mg/ml v desetimililitrové lahvičce je 10 mg,
 * ne 1 mg. Bez tohohle rozlišení vycházejí u perfuzorů nesmyslná ředění.
 */
export function vialContentMg(product: Product): number {
  if (product.volumeMl === undefined) return product.strength;
  const vialMl = product.packUnitVolumeMl ?? product.volumeMl;
  return concentrationOf(product) * vialMl;
}
