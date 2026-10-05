import type { Rng } from "../random";
import { PRODUCTS, DLP_RELEASE } from "./pool.generated";
import type { Container, Product, ProductKind } from "./types";

export { PRODUCTS, DLP_RELEASE };
export type { Container, Product, ProductKind };

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
  /**
   * Typ obalu u ampulí. Bez uvedení jen lahvičky a ampule: většina
   * šablon se ptá, kolik natáhnout stříkačkou, a to z pera, vložky ani
   * předplněné stříkačky nejde.
   */
  containers?: readonly Container[];
};

/**
 * Nosné infuzní roztoky: glukóza a krystaloidy. Jen u nich dává smysl
 * libovolná rychlost a doba infuze. U léku ve vaku je rychlost součástí
 * dávkování (levofloxacin nejméně 60 min, dexmedetomidin v µg/kg/h),
 * a „250 ml/h dexmedetomidinu“ by bylo nebezpečné cvičení.
 */
export const BASE_SOLUTION_ATC = ["B05BA03", "B05BB"] as const;

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
    if (filter.kind === "ampoule") {
      const allowed = filter.containers ?? ["vial"];
      if (!product.container || !allowed.includes(product.container)) return false;
    }
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

/** Přípravek podle kódu SÚKL. Používají ho šablony vázané na konkrétní SPC. */
export function productByCode(code: string): Product {
  const product = PRODUCTS.find((item) => item.code === code);
  if (!product) throw new Error(`Přípravek s kódem SÚKL ${code} není ve fondu.`);
  return product;
}

/**
 * Nejvíc jednotek inzulinu na jedno natažení z lahvičky.
 *
 * SPC uvádí jen denní potřebu 0,3–1,0 IU/kg, strop jedné dávky nemá.
 * Meze jsou proto návrhové rozhodnutí (docs/zdroje.md, oddíl 8): rychlý
 * inzulin k jídlu (ATC A10AB) nad 30 IU naráz lékař přečte jako chybu,
 * bazální a směsný se dávkuje jednou až dvakrát denně a unese 60 IU.
 */
export function insulinMaxDoseIU(product: Product): number {
  return product.atc.startsWith("A10AB") ? 30 : 60;
}
