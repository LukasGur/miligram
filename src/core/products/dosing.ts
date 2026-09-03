import type { Source } from "../types";
import { productByCode } from "./index";

/**
 * Dávkovací rozmezí ověřená v SPC konkrétních přípravků.
 *
 * Proč tahle tabulka existuje odděleně od fondu v pool.generated.ts:
 * fond obsahuje síly a balení, které jdou z databáze SÚKL vyčíst strojově.
 * Dávkovací rozmezí strojově vyčíst nejdou — jsou v textu bodu 4.2 SPC
 * a každé z nich je sem opsané ručně z konkrétního dokumentu.
 *
 * Šablona smí tvrdit „obvyklá dávka je …“ jen tehdy, když si vezme
 * záznam odsud. Kde tahle tabulka nic nemá, musí být dávka součástí
 * zadání a žádné rozmezí se netvrdí.
 *
 * Každý záznam odkazuje na soubor SPC v archivu SÚKL SPC20260827.zip.
 * Ověřeno 2.–3. 9. 2026.
 */

export type DoseRange = {
  /** Dolní a horní mez v jednotce uvedené v `unit`. */
  min: number;
  max: number;
  unit: "mg/kg" | "mg/kg/den" | "µg/kg/den" | "µg/kg/min" | "µg/min" | "mg/m2";
};

export type DosingRule = {
  /** Kód SÚKL přípravku, jehož SPC je zdrojem. */
  suklCode: string;
  /** Obchodní název tak, jak ho uvádí SPC. */
  product: string;
  substance: string;
  /** Soubor v archivu SÚKL SPC20260827.zip. */
  spc: string;
  /** Dávka na jedno podání. */
  single?: DoseRange;
  /** Celková denní dávka. */
  daily?: DoseRange;
  /** Do kolika podání se denní dávka dělí. */
  dosesPerDay?: readonly number[];
  /** Nepřekročitelná denní dávka. */
  maxDaily?: DoseRange;
  /** Nepřekročitelná dávka na jedno podání, v mg. */
  maxSingleMg?: number;
  /** Nasycovací dávka, je-li v SPC uvedená. */
  loading?: DoseRange;
  /**
   * Údaje o balení pro přípravky, které nejsou v automatickém fondu.
   * Kombinovaný přípravek má nejednoznačnou sílu, takže ho parser do fondu
   * nepustí — u Augmentinu je pro výpočet rozhodná amoxicilinová složka
   * a tu je potřeba uvést výslovně.
   */
  presentation?: {
    /** Obsah rozhodné složky v referenčním objemu, v mg. */
    strengthMg: number;
    /** Objem, ve kterém je síla uvedená. U lyofilizátů chybí. */
    referenceMl?: number;
    /** Objem celého balení v ml. U lyofilizátů chybí. */
    packVolumeMl?: number;
  };
  /** Doslovná pasáž z SPC, o kterou se záznam opírá. */
  quote: string;
};

const SPC_SOURCE = (rule: DosingRule): Source => ({
  citation: `SÚKL, SPC přípravku ${rule.product}, bod 4.2: „${rule.quote}“`,
  url: "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics",
  suklCode: rule.suklCode,
  verifiedAt: "2026-09-02",
});

export const DOSING_RULES = {
  paracetamolDeti: {
    suklCode: "0254422",
    product: "PARALEN 125 mg tablety",
    substance: "PARACETAMOL",
    spc: "SPC224021.pdf",
    single: { min: 10, max: 15, unit: "mg/kg" },
    maxDaily: { min: 60, max: 60, unit: "mg/kg/den" },
    dosesPerDay: [3, 4],
    quote:
      "Celková denní dávka za 24 hodin nemá překročit 60 mg/kg tělesné hmotnosti dítěte; " +
      "dělí se na 3–4 dílčí dávky. Pro jednorázové podání je dávka 10–15 mg/kg tělesné hmotnosti.",
  },

  ibuprofenBaby: {
    suklCode: "0254306",
    product: "Ibalgin Baby 20 mg/ml perorální suspenze",
    substance: "IBUPROFEN",
    spc: "SPC226792.pdf",
    single: { min: 5, max: 10, unit: "mg/kg" },
    maxDaily: { min: 40, max: 40, unit: "mg/kg/den" },
    dosesPerDay: [3, 4],
    presentation: { strengthMg: 20, referenceMl: 1, packVolumeMl: 100 },
    quote:
      "Používá se jednotlivá dávka 5-10 mg ibuprofenu/kg tělesné hmotnosti, " +
      "denní dávka by neměla překročit 40 mg ibuprofenu/kg tělesné hmotnosti.",
  },

  ibuprofenDeti: {
    suklCode: "0237380",
    product: "Nurofen pro děti 20 mg/ml perorální suspenze",
    substance: "IBUPROFEN",
    spc: "SPC215152.pdf",
    daily: { min: 20, max: 30, unit: "mg/kg/den" },
    dosesPerDay: [3, 4],
    presentation: { strengthMg: 20, referenceMl: 1, packVolumeMl: 50 },
    quote:
      "U kojenců a dětí od 3 měsíců do 12 let je obvyklá denní dávka 20–30 mg/kg, " +
      "která se podává rozděleně do 3–4 dílčích dávek, s intervalem dávkování 6–8 hodin.",
  },

  amoxicilin: {
    suklCode: "0066366",
    product: "Ospamox 250 mg/5 ml prášek pro perorální suspenzi",
    substance: "AMOXICILIN",
    spc: "SPC197336.pdf",
    daily: { min: 40, max: 90, unit: "mg/kg/den" },
    dosesPerDay: [3],
    presentation: { strengthMg: 250, referenceMl: 5, packVolumeMl: 60 },
    quote: "Akutní streptokoková tonzilitida a faryngitida 40 až 90 mg/kg/den v dílčích dávkách.",
  },

  amoxicilinKlavulanat: {
    suklCode: "0285509",
    product: "Augmentin 400 mg/5 ml + 57 mg/5 ml prášek pro perorální suspenzi",
    substance: "AMOXICILIN",
    spc: "SPC234098.pdf",
    daily: { min: 25, max: 45, unit: "mg/kg/den" },
    dosesPerDay: [2],
    presentation: { strengthMg: 400, referenceMl: 5, packVolumeMl: 35 },
    quote:
      "Nižší dávka: 25 mg/3,6 mg/kg/den až 45 mg/6,4 mg/kg/den užívané ve dvou oddělených dávkách.",
  },

  gentamicin: {
    suklCode: "0096414",
    product: "Gentamicin Lek 80 mg/2 ml injekční/infuzní roztok",
    substance: "GENTAMICIN",
    spc: "SPC209840.pdf",
    daily: { min: 3, max: 6, unit: "mg/kg/den" },
    maxDaily: { min: 7.5, max: 7.5, unit: "mg/kg/den" },
    dosesPerDay: [1, 3],
    presentation: { strengthMg: 80, referenceMl: 2, packVolumeMl: 2 },
    quote:
      "Doporučená denní dávka u dětí, dospívajících a dospělých s normální funkcí ledvin " +
      "je 3–6 mg/kg. Maximální denní dávka gentamicinu je 7,5 mg/kg.",
  },

  vankomycin: {
    suklCode: "0156259",
    product: "Vancomycin Kabi 1000 mg prášek pro koncentrát pro infuzní roztok",
    substance: "VANKOMYCIN",
    spc: "SPC231903.pdf",
    single: { min: 15, max: 20, unit: "mg/kg" },
    loading: { min: 25, max: 30, unit: "mg/kg" },
    maxSingleMg: 2000,
    dosesPerDay: [2, 3],
    quote:
      "Doporučená dávka je 15 až 20 mg/kg těl. hm. každých 8 až 12 hodin " +
      "(nesmí se překročit 2 g na jednu dávku). U závažně nemocných pacientů může být " +
      "použita nasycovací dávka 25–30 mg/kg těl. hm.",
  },

  ceftriaxonDeti: {
    suklCode: "0121237",
    product: "Ceftriaxon Kabi 1 g prášek pro injekční/infuzní roztok",
    substance: "CEFTRIAXON",
    spc: "SPC212156.pdf",
    single: { min: 50, max: 80, unit: "mg/kg" },
    dosesPerDay: [1],
    quote:
      "50–80 mg/kg jednou denně. 50 mg/kg nebo vyšší se u kojenců a dětí " +
      "ve věku do 12 let podávají infuzí.",
  },

  meropenem: {
    suklCode: "0232677",
    product: "Meropenem AptaPharma 1000 mg prášek pro injekční/infuzní roztok",
    substance: "MEROPENEM",
    spc: "SPC226307.pdf",
    single: { min: 10, max: 40, unit: "mg/kg" },
    dosesPerDay: [3],
    presentation: { strengthMg: 1000 },
    quote: "Vhodným dávkovacím režimem mohlo být 20 mg/kg každých 8 hodin; akutní bakteriální meningitida 40 mg/kg.",
  },

  enoxaparin: {
    suklCode: "0115402",
    product: "CLEXANE 6 000 IU (60 mg)/0,6 ml injekční roztok",
    substance: "ENOXAPARIN",
    spc: "SPC205710.pdf",
    single: { min: 1, max: 1, unit: "mg/kg" },
    dosesPerDay: [2],
    presentation: { strengthMg: 60, referenceMl: 0.6, packVolumeMl: 0.6 },
    quote:
      "Sodná sůl enoxaparinu se může podávat s.c. injekcí buď jednou denně 150 IU/kg (1,5 mg/kg), " +
      "nebo dvakrát denně 100 IU/kg (1 mg/kg).",
  },

  adrenalinResuscitace: {
    suklCode: "0000362",
    product: "Adrenalin Léčiva 1 mg/ml injekční roztok",
    substance: "EPINEFRIN",
    spc: "SPC217219.pdf",
    single: { min: 0.01, max: 0.03, unit: "mg/kg" },
    maxSingleMg: 1,
    presentation: { strengthMg: 1, referenceMl: 1, packVolumeMl: 1 },
    quote:
      "0,01 mg/kg tělesné hmotnosti i.v. nebo i. o. každých 3–5 minut (maximálně 1 mg); " +
      "u novorozenců 0,01–0,03 mg/kg každých 5 minut.",
  },

  digoxin: {
    suklCode: "0083318",
    product: "Digoxin Léčiva 0,125 mg tablety",
    substance: "DIGOXIN",
    spc: "SPC236508.pdf",
    daily: { min: 10, max: 25, unit: "µg/kg/den" },
    loading: { min: 10, max: 50, unit: "µg/kg/den" },
    dosesPerDay: [1],
    quote:
      "Udržovací denní dávka se pohybuje v rozsahu 10–25 µg/kg tělesné hmotnosti 1x denně; " +
      "nárazová dávka v rozmezí 10–50 µg/kg tělesné hmotnosti.",
  },

  noradrenalin: {
    suklCode: "0000536",
    product: "Noradrenalin Léčiva 1 mg/ml koncentrát pro infuzní roztok",
    substance: "NOREPINEFRIN",
    spc: "SPC191989.pdf",
    single: { min: 2, max: 12, unit: "µg/min" },
    quote:
      "Dospělým se podává zpočátku 0,5-1 μg/min, rychlost podávání upravujeme podle výše " +
      "krevního tlaku, udržovací dávka je 2-12 μg/min.",
  },

  dobutamin: {
    suklCode: "0252131",
    product: "Dobutamin hameln 5 mg/ml infuzní roztok",
    substance: "DOBUTAMIN",
    spc: "SPC219162.pdf",
    single: { min: 2, max: 20, unit: "µg/kg/min" },
    quote: "5 μg/kg/min upravená podle klinické odpovědi na 2 - 20 μg/kg/min.",
  },

  paklitaxel: {
    suklCode: "0104239",
    product: "Paclitaxel Ebewe 6 mg/ml koncentrát pro infuzní roztok",
    substance: "PAKLITAXEL",
    spc: "SPC200355.pdf",
    single: { min: 135, max: 175, unit: "mg/m2" },
    presentation: { strengthMg: 6, referenceMl: 1, packVolumeMl: 5 },
    quote:
      "Doporučuje se dvojí typ dávkování: 175 mg/m2 paklitaxelu aplikovat intravenózně " +
      "po dobu 3 hodin, nebo 135 mg/m2 podat v 24 hodinové infuzi.",
  },

  karboplatina: {
    suklCode: "0241270",
    product: "Carboplatin Accord 10 mg/ml koncentrát pro infuzní roztok",
    substance: "KARBOPLATINA",
    spc: "SPC212755.pdf",
    single: { min: 200, max: 400, unit: "mg/m2" },
    presentation: { strengthMg: 10, referenceMl: 1, packVolumeMl: 5 },
    quote:
      "U dosud neléčených dospělých pacientů s normální funkcí ledvin, tj. clearance kreatininu " +
      "> 60 ml/min, je 400 mg/m2; při 41-59 ml/min 250 mg/m2, při 16-40 ml/min 200 mg/m2.",
  },
} as const satisfies Record<string, DosingRule>;

export type DosingRuleId = keyof typeof DOSING_RULES;

/**
 * Pravidla se širším typem. Zápis `as const` u tabulky zúží typ na
 * konkrétní hodnoty, což je fajn pro našeptávání, ale procházet se přes to
 * nedá — proto tenhle pohled.
 */
export const DOSING_RULE_LIST = Object.entries(DOSING_RULES) as ReadonlyArray<
  readonly [DosingRuleId, DosingRule]
>;

export function dosingSource(id: DosingRuleId): Source {
  return SPC_SOURCE(DOSING_RULES[id]);
}

export function dosingRule(id: DosingRuleId): DosingRule {
  return DOSING_RULES[id];
}

/**
 * Údaje o balení pro šablonu, která z pravidla počítá objem.
 * Přednost má výslovný záznam u pravidla, jinak se sáhne do fondu.
 */
/** Balení včetně objemu. Pro šablony, které z pravidla počítají mililitry. */
export function liquidPresentationOf(id: DosingRuleId): {
  strengthMg: number;
  referenceMl: number;
  packVolumeMl: number;
} {
  const presentation = presentationOf(id);
  if (presentation.referenceMl === undefined || presentation.packVolumeMl === undefined) {
    throw new Error(`Pravidlo ${id} nemá objemové údaje, objem z něj spočítat nelze.`);
  }
  return {
    strengthMg: presentation.strengthMg,
    referenceMl: presentation.referenceMl,
    packVolumeMl: presentation.packVolumeMl,
  };
}

export function presentationOf(id: DosingRuleId): NonNullable<DosingRule["presentation"]> {
  const rule = dosingRule(id);
  if (rule.presentation) return rule.presentation;

  /**
   * Fond dedupuje na jednu reprezentaci účinné látky, takže konkrétní
   * přípravek z pravidla v něm být nemusí. Když tam není a pravidlo
   * balení neuvádí, je to chyba v datech, ne stav k obejití.
   */
  const product = productByCode(rule.suklCode);
  return {
    strengthMg: product.strength,
    referenceMl: product.volumeMl,
    packVolumeMl: product.packUnitVolumeMl,
  };
}
