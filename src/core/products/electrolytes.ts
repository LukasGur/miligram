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
  /**
   * Molární hmotnost soli, pokud ji SPC uvádí tak, že z něj jde odvodit
   * beze zbytku (například „58,5 mg/ml … 1 mol/l“). Tam, kde SPC udává jen
   * zaokrouhlené mmol na mililitr, zůstává nevyplněná — dopočítávat ji
   * zpětně by znamenalo tvrdit přesnost, kterou zdroj nemá.
   */
  molarMassGPerMol?: number;
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
    molarMassGPerMol: 74.5,
    quote:
      "1000 ml koncentrátu pro infuzní roztok obsahuje kalii chloridum 74,5 g. " +
      "Obsah elektrolytů: K+ 1000 mmol/l, Cl- 1000 mmol/l.",
  },

  natriumChlorid585: {
    suklCode: "0055913",
    product: "Chlorid sodný B. Braun 5,85% koncentrát pro infuzní roztok",
    spc: "SPC189696.pdf",
    mgPerMl: 58.5,
    percent: 5.85,
    ion: "Na+",
    mmolPerMl: 1,
    valence: 1,
    molarMassGPerMol: 58.5,
    quote:
      "1 ml koncentrátu pro infuzní roztok obsahuje Natrii chloridum 58,5 mg. " +
      "Elektrolyty: Sodík 1 mol/l, Chlorid 1 mol/l.",
  },

  natriumChlorid09: {
    suklCode: "0047308",
    product: "Chlorid sodný B. Braun 0,9 % infuzní roztok",
    spc: "SPC216028.pdf",
    mgPerMl: 9,
    percent: 0.9,
    ion: "Na+",
    mmolPerMl: 0.154,
    valence: 1,
    quote:
      "1000 ml roztoku obsahuje: natrii chloridum 9,00 g. " +
      "Koncentrace elektrolytů: Sodík 154 mmol/l, Chlorid 154 mmol/l.",
  },

  /**
   * Hořčík je jediný dvojmocný ion v tabulce, a proto v ní musí být:
   * u jednomocných iontů mmol a mEq číselně splývají a rozdíl mezi nimi
   * se nedá ukázat. SPC ho navíc uvádí v obou jednotkách současně.
   */
  magnesiumSulfat100: {
    suklCode: "0231541",
    product: "Magnesium sulfate Kalceks 100 mg/ml injekční/infuzní roztok",
    spc: "SPC191610.pdf",
    mgPerMl: 100,
    percent: 10,
    ion: "Mg2+",
    mmolPerMl: 0.41,
    valence: 2,
    quote:
      "Jeden ml roztoku obsahuje magnesii sulfas heptahydricus 100 mg. " +
      "Magnesii sulfas heptahydricus 1 g = magnesium 98,6 mg nebo 8,1 mEq nebo 4,1 mmol.",
  },

  magnesiumSulfat200: {
    suklCode: "0231544",
    product: "Magnesium sulfate Kalceks 200 mg/ml injekční/infuzní roztok",
    spc: "SPC191610.pdf",
    mgPerMl: 200,
    percent: 20,
    ion: "Mg2+",
    mmolPerMl: 0.82,
    valence: 2,
    quote:
      "Jeden ml roztoku obsahuje magnesii sulfas heptahydricus 200 mg. " +
      "Magnesii sulfas heptahydricus 1 g = magnesium 98,6 mg nebo 8,1 mEq nebo 4,1 mmol.",
  },
} as const satisfies Record<string, Electrolyte>;

export type ElectrolyteId = keyof typeof ELECTROLYTES;

export const ELECTROLYTE_LIST = Object.entries(ELECTROLYTES) as ReadonlyArray<
  readonly [ElectrolyteId, Electrolyte]
>;

/**
 * Draselné koncentráty. Šablony, které se opírají o hodinový limit přísunu
 * draslíku, smějí losovat jen z nich — u hořčíku ani u sodíku ten limit
 * neplatí a tvrdit ho by bylo nesprávné.
 */
export const POTASSIUM_LIST = ELECTROLYTE_LIST.filter(([, item]) => item.ion === "K+");

/** Koncentráty s molární hmotností doloženou v SPC. */
export const MOLAR_MASS_LIST = ELECTROLYTE_LIST.filter(([, item]) => item.molarMassGPerMol !== undefined);

export function electrolyte(id: ElectrolyteId): Electrolyte {
  return ELECTROLYTES[id];
}

export function electrolyteSource(id: ElectrolyteId): Source {
  const item = ELECTROLYTES[id];
  return {
    citation: `SÚKL, SPC přípravku ${item.product}, bod 2: „${item.quote}“`,
    url: "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics",
    suklCode: item.suklCode,
    verifiedAt: "2026-09-03",
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
