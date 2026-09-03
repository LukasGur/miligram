import type { Source } from "../types";

/**
 * Postupy rekonstituce a limity ředění opsané z bodu 6.6 SPC.
 *
 * Objem rozpouštědla ani maximální koncentrace v infuzi nejsou v databázi
 * léčivých přípravků — jsou v textu SPC a liší se přípravek od přípravku.
 * Šablona, která je tvrdí, si je musí vzít odsud.
 */
export type ReconstitutionRule = {
  suklCode: string;
  product: string;
  spc: string;
  /** Obsah lyofilizátu v lahvičce, v mg. */
  vialMg: number;
  /** Objem rozpouštědla podle SPC, v ml. */
  diluentMl: number;
  /** Koncentrace po rekonstituci, v mg/ml. */
  reconstitutedMgPerMl: number;
  /** Nejvyšší přípustná koncentrace v hotové infuzi, je-li v SPC uvedená. */
  maxInfusionMgPerMl?: number;
  /** Nejmenší objem hotové infuze podle SPC, v ml. */
  minInfusionMl?: number;
  /** Rozsah konečné koncentrace, uvádí-li SPC interval místo limitu. */
  finalRangeMgPerMl?: { min: number; max: number };
  quote: string;
};

export const RECONSTITUTION_RULES = {
  ceftriaxon1g: {
    suklCode: "0121237",
    product: "Ceftriaxon Kabi 1 g prášek pro injekční/infuzní roztok",
    spc: "SPC212156.pdf",
    vialMg: 1000,
    diluentMl: 10,
    reconstitutedMgPerMl: 100,
    quote:
      "Intravenózní injekce: Rozpouštědlo voda pro injekci, ceftriaxon 1 g, objem rozpouštědla 10 ml, " +
      "přibližná koncentrace ceftriaxonu v konečném roztoku 100 mg/ml.",
  },

  vankomycin1g: {
    suklCode: "0156259",
    product: "Vancomycin Kabi 1000 mg prášek pro koncentrát pro infuzní roztok",
    spc: "SPC231903.pdf",
    vialMg: 1000,
    diluentMl: 20,
    reconstitutedMgPerMl: 50,
    maxInfusionMgPerMl: 5,
    minInfusionMl: 200,
    quote:
      "Obsah jedné injekční lahvičky s 1000 mg vankomycinu se naředí ve 20 ml sterilní vody pro injekci. " +
      "Jeden ml rekonstituovaného roztoku obsahuje 50 mg vankomycinu. Rekonstituovaný roztok obsahující " +
      "1000 mg vankomycinu (50 mg/ml) se musí dále naředit minimálně 200 ml rozpouštědla. " +
      "Koncentrace vankomycinu v infuzním roztoku nesmí přesahovat 5 mg/ml.",
  },

  vankomycin500: {
    suklCode: "0156258",
    product: "Vancomycin Kabi 500 mg prášek pro koncentrát pro infuzní roztok",
    spc: "SPC231903.pdf",
    vialMg: 500,
    diluentMl: 10,
    reconstitutedMgPerMl: 50,
    maxInfusionMgPerMl: 5,
    minInfusionMl: 100,
    quote:
      "Obsah jedné injekční lahvičky s 500 mg vankomycinu se naředí v 10 ml sterilní vody pro injekci. " +
      "Rekonstituovaný roztok obsahující 500 mg vankomycinu (50 mg/ml) se musí dále naředit " +
      "s minimálně 100 ml rozpouštědla.",
  },

  meropenem1g: {
    suklCode: "0232677",
    product: "Meropenem AptaPharma 1000 mg prášek pro injekční/infuzní roztok",
    spc: "SPC226307.pdf",
    vialMg: 1000,
    diluentMl: 20,
    reconstitutedMgPerMl: 50,
    finalRangeMgPerMl: { min: 1, max: 20 },
    quote:
      "Pro intravenózní infuzi mohou být injekční lahvičky s meropenem přímo naředěny roztokem " +
      "chloridu sodného 9 mg/ml (0,9%) pro infuzi nebo roztokem glukózy 50 mg/ml (5%) pro infuzi " +
      "na konečnou koncentraci 1 až 20 mg/ml.",
  },
} as const satisfies Record<string, ReconstitutionRule>;

export type ReconstitutionRuleId = keyof typeof RECONSTITUTION_RULES;

export const RECONSTITUTION_LIST = Object.entries(RECONSTITUTION_RULES) as ReadonlyArray<
  readonly [ReconstitutionRuleId, ReconstitutionRule]
>;

export function reconstitutionRule(id: ReconstitutionRuleId): ReconstitutionRule {
  return RECONSTITUTION_RULES[id];
}

export function reconstitutionSource(id: ReconstitutionRuleId): Source {
  const rule = RECONSTITUTION_RULES[id];
  return {
    citation: `SÚKL, SPC přípravku ${rule.product}, bod 6.6: „${rule.quote}“`,
    url: "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics",
    suklCode: rule.suklCode,
    verifiedAt: "2026-09-02",
  };
}
