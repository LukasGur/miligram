import type { Source } from "../types";

/**
 * Úprava dávkování podle funkce ledvin, opsaná z bodu 4.2 SPC.
 *
 * Dvě strategie, které se v praxi míchají a studenti si je pletou:
 * snížit dávku, nebo prodloužit interval. SPC vankomycinu obě popisuje
 * výslovně, proto je zdrojem pro obě šablony.
 */

const SPC_URL =
  "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics";

/** Pásmo clearance kreatininu s odpovídajícím dávkováním. */
export type RenalBand = {
  /** Dolní mez clearance v ml/min, včetně. */
  minCrCl: number;
  /** Horní mez clearance v ml/min, včetně. Chybí u nejvyššího pásma. */
  maxCrCl?: number;
  /** Dávka v jednotce uvedené u pravidla. */
  dose?: number;
  /** Interval mezi dávkami v hodinách. */
  intervalHours?: number;
};

export type RenalRule = {
  suklCode: string;
  product: string;
  substance: string;
  spc: string;
  /** Jednotka dávky v pásmech. */
  doseUnit: "mg/kg" | "mg/m2";
  bands: readonly RenalBand[];
  quote: string;
};

export const RENAL_RULES = {
  /**
   * Vankomycin u dospělých. SPC neuvádí tabulku pásem, ale jedno konkrétní:
   * při clearance 20–49 ml/min se táž dávka podává jednou za 24 hodin
   * místo obvyklých 8–12 hodin. Právě o to v šabloně jde — mění se interval,
   * ne velikost dávky.
   */
  vankomycinDospeli: {
    suklCode: "0156259",
    product: "Vancomycin Kabi 1000 mg prášek pro koncentrát pro infuzní roztok",
    substance: "VANKOMYCIN",
    spc: "SPC231903.pdf",
    doseUnit: "mg/kg",
    bands: [
      { minCrCl: 50, dose: 15, intervalHours: 12 },
      { minCrCl: 20, maxCrCl: 49, dose: 15, intervalHours: 24 },
    ],
    quote:
      "Obvyklá počáteční dávka pro dospělé pacienty je 15 až 20 mg/kg, má být podána každých " +
      "24 hodin u pacientů s clearance kreatininu mezi 20 až 49 ml/min. U pacientů s lehkou nebo " +
      "středně těžkou poruchou funkce ledvin se počáteční dávka nesmí snižovat. U pacientů " +
      "s těžkou poruchou funkce ledvin je vhodnější raději prodloužit interval mezi podáním " +
      "než podávat nižší denní dávky.",
  },

  /**
   * Vankomycin u dětí. Tady SPC tabulku má, a to v jednotkách eGFR
   * na 1,73 m² povrchu těla — pásma se proto nesmějí zaměňovat
   * s clearance u dospělých.
   */
  vankomycinDeti: {
    suklCode: "0156259",
    product: "Vancomycin Kabi 1000 mg prášek pro koncentrát pro infuzní roztok",
    substance: "VANKOMYCIN",
    spc: "SPC231903.pdf",
    doseUnit: "mg/kg",
    bands: [
      { minCrCl: 30, maxCrCl: 50, dose: 15, intervalHours: 12 },
      { minCrCl: 10, maxCrCl: 29, dose: 15, intervalHours: 24 },
    ],
    quote:
      "Orientační doporučení dávkování pro pediatrickou populaci: GFR (ml/min/1,73 m2) 50-30 — " +
      "i.v. dávka 15 mg/kg — frekvence po 12 hodinách; 29-10 — 15 mg/kg — po 24 hodinách.",
  },

  /**
   * Karboplatina. Jediné pravidlo v tabulce, kde se dávka opravdu snižuje —
   * proto se na něm dá ukázat rozdíl proti prodloužení intervalu.
   */
  karboplatina: {
    suklCode: "0241270",
    product: "Carboplatin Accord 10 mg/ml koncentrát pro infuzní roztok",
    substance: "KARBOPLATINA",
    spc: "SPC212755.pdf",
    doseUnit: "mg/m2",
    bands: [
      { minCrCl: 60, dose: 400 },
      { minCrCl: 41, maxCrCl: 59, dose: 250 },
      { minCrCl: 16, maxCrCl: 40, dose: 200 },
    ],
    quote:
      "U dosud neléčených dospělých pacientů s normální funkcí ledvin, tj. clearance kreatininu " +
      "> 60 ml/min, je 400 mg/m2; při 41-59 ml/min 250 mg/m2, při 16-40 ml/min 200 mg/m2.",
  },
} as const satisfies Record<string, RenalRule>;

export type RenalRuleId = keyof typeof RENAL_RULES;

export const RENAL_RULE_LIST = Object.entries(RENAL_RULES) as ReadonlyArray<
  readonly [RenalRuleId, RenalRule]
>;

export function renalRule(id: RenalRuleId): RenalRule {
  return RENAL_RULES[id];
}

export function renalSource(id: RenalRuleId): Source {
  const rule = RENAL_RULES[id];
  return {
    citation: `SÚKL, SPC přípravku ${rule.product}, bod 4.2: „${rule.quote}“`,
    url: SPC_URL,
    suklCode: rule.suklCode,
    verifiedAt: "2026-09-03",
  };
}

/**
 * Pásmo, do kterého clearance spadá. Vrací null mimo rozsah tabulky —
 * pod nejnižší mez SPC dávkování neurčuje a šablona tam nesmí zabíhat.
 */
export function bandFor(id: RenalRuleId, crClMlPerMin: number): RenalBand | null {
  return renalRule(id).bands.find(
    (band) => crClMlPerMin >= band.minCrCl && (band.maxCrCl === undefined || crClMlPerMin <= band.maxCrCl),
  ) ?? null;
}

/**
 * Cockcroft–Gaultův vzorec cituje i SPC vankomycinu. Uvádíme ho vedle
 * původní práce proto, že šablony počítají clearance kvůli konkrétnímu
 * dávkování z tohoto SPC — je poctivé ukázat, že vzorec a pásma pocházejí
 * z téhož dokumentu.
 */
export const COCKCROFT_GAULT_SPC_SOURCE: Source = {
  citation:
    "SÚKL, SPC přípravku Vancomycin Kabi 1000 mg, bod 4.2: „Muži: [tělesná hmotnost (kg) x " +
    "140 - věk (roky)]/ 72 x sérový kreatinin (mg/dl); Ženy: 0,85 x hodnota vypočtená podle " +
    "výše uvedeného vzorce.“",
  url: SPC_URL,
  suklCode: "0156259",
  verifiedAt: "2026-09-03",
};
