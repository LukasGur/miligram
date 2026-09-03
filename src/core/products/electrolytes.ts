import type { Source } from "../types";

/**
 * Elektrolytové koncentráty s obsahem iontů odečteným z bodu 2 SPC.
 *
 * Látkové množství nejde z databáze léčivých přípravků vyčíst — DLP uvádí
 * jen hmotnostní koncentraci. Obsah v milimolech proto pochází z kvalitativního
 * a kvantitativního složení konkrétního SPC a je sem opsaný ručně.
 */
export type Electrolyte = {
  suklCode: string;
  product: string;
  spc: string;
  /** Hmotnostní koncentrace soli v mg/ml, jak ji uvádí DLP i SPC. */
  mgPerMl: number;
  /** Procentní vyjádření téže koncentrace. */
  percent: number;
  ion: string;
  /** Látkové množství iontu v jednom mililitru. */
  mmolPerMl: number;
  /** Mocenství iontu — rozhoduje o převodu mmol na mEq. */
  valence: number;
  quote: string;
};

export const ELECTROLYTES = {
  kaliumChlorid745: {
    suklCode: "0069737",
    product: "Ardeaelytosol conc. kaliumchlorid 7,45% koncentrát pro infuzní roztok",
    spc: "SPC159050.pdf",
    mgPerMl: 74.5,
    percent: 7.45,
    ion: "K+",
    mmolPerMl: 1,
    valence: 1,
    quote:
      "1000 ml koncentrátu pro infuzní roztok obsahuje kalii chloridum 74,5 g. " +
      "Obsah elektrolytů: K+ 1000 mmol/l, Cl- 1000 mmol/l.",
  },
} as const satisfies Record<string, Electrolyte>;

export type ElectrolyteId = keyof typeof ELECTROLYTES;

export const ELECTROLYTE_LIST = Object.entries(ELECTROLYTES) as ReadonlyArray<
  readonly [ElectrolyteId, Electrolyte]
>;

export function electrolyte(id: ElectrolyteId): Electrolyte {
  return ELECTROLYTES[id];
}

export function electrolyteSource(id: ElectrolyteId): Source {
  const item = ELECTROLYTES[id];
  return {
    citation: `SÚKL, SPC přípravku ${item.product}, bod 2: „${item.quote}“`,
    url: "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics",
    suklCode: item.suklCode,
    verifiedAt: "2026-09-02",
  };
}

/**
 * Maximální rychlost přísunu draslíku podle SPC. Není to tolerance ani
 * doporučení aplikace — je to limit, o který se opírá zadání.
 */
export const POTASSIUM_MAX_MMOL_PER_HOUR = 20;
export const POTASSIUM_MAX_MMOL_PER_LITRE = 40;
export const POTASSIUM_LIMIT_SOURCE: Source = {
  citation:
    "SÚKL, SPC přípravku Ardeaelytosol conc. kaliumchlorid 7,45%, bod 4.2: " +
    "„Koncentrace kalia v infuzním roztoku nemá přesáhnout 40 mmol/l, rychlost přísunu " +
    "kalia do organismu je max. 20 mmol/hod u dospělého pacienta.“",
  suklCode: "0069737",
  verifiedAt: "2026-09-02",
};
