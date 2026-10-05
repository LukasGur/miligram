import type { Source } from "../types";

/**
 * Kolik místa zabere prášek po rozpuštění — z bodu 6.6 SPC.
 *
 * Proč tahle tabulka existuje: úloha E4 dřív objem prášku i rozpouštědla
 * losovala („prášek zabírá 0,5 ml“), a u konkrétního přípravku tak tvrdila
 * údaj, který nikde nestojí. SPC ho uvádí dvojím způsobem:
 *
 *  - `finalMl` — objem hotového roztoku přímo (AZEPO, Ampicilin BBP).
 *    Objem prášku je jen rozdíl dvou čísel ze SPC.
 *  - `approxMgPerMl` — přibližná koncentrace po přidání rozpouštědla
 *    (Fortum, AXETINE, Ceftriaxon Kabi i.m.). Objem prášku si student
 *    dopočítá sám; SPC výslovně píše, že koncentrace je nižší „v důsledku
 *    směšovacího faktoru“.
 *
 * Ověřeno 5. 10. 2026 z archivu SPC20260827.zip.
 */
export type PowderVolume = {
  /** Kód SÚKL přípravku ve fondu. */
  suklCode: string;
  product: string;
  spc: string;
  vialMg: number;
  /** Objem přidaného rozpouštědla v ml. */
  diluentMl: number;
  /** Objem hotového roztoku, uvádí-li ho SPC. */
  finalMl?: number;
  /** Přibližná koncentrace hotového roztoku, uvádí-li ji SPC. */
  approxMgPerMl?: number;
  quote: string;
};

const VERIFIED_AT = "2026-10-05";

const AZEPO_QUOTE =
  "Cefazolin 1 g: objem rozpouštědla 2,5 ml, přibližná výsledná koncentrace 330 mg/ml, " +
  "přibližný využitelný objem 3,0 ml.";
const AMPICILIN_QUOTE =
  "Přidáním 1,8 ml vody na injekci k 0,5 g ampicilinu vzniknou 2 ml roztoku ampicilinu o koncentraci " +
  "250 mg/ml, přidáním 3,5 ml vody na injekci k 1,0 g ampicilinu vzniknou 4 ml roztoku ampicilinu " +
  "o koncentraci 250 mg/ml.";
const FORTUM_QUOTE =
  "Tabulka 7: 500 mg: intramuskulární injekce 1,5 ml, 260 mg/ml; intravenózní bolusová injekce 5 ml, " +
  "90 mg/ml. 1 g: intramuskulární injekce 3 ml, 260 mg/ml; intravenózní bolusová injekce 10 ml, 90 mg/ml. " +
  "Výsledný objem roztoku ceftazidimu v rekonstitučním médiu se zvyšuje v důsledku směšovacího faktoru " +
  "léčivého přípravku, což vede ke koncentracím v mg/ml uvedeným v tabulce výše.";
const AXETINE_QUOTE =
  "750 mg: intramuskulárně 3 ml, 216 mg/ml; intravenózní bolus alespoň 6 ml, 116 mg/ml. " +
  "1,5 g: intramuskulárně 6 ml, 216 mg/ml; intravenózní bolus alespoň 15 ml, 94 mg/ml. " +
  "Výsledný objem roztoku cefuroximu v rekonstitučním médiu je zvýšen vlivem objemového faktoru léčivé látky.";
const CEFTRIAXON_QUOTE =
  "Intramuskulární injekce: 1% roztok hydrochloridu lidokainu, ceftriaxon 1 g, objem rozpouštědla 3 ml, " +
  "přibližná koncentrace ceftriaxonu v konečném roztoku 285 mg/ml.";

export const POWDER_VOLUMES: readonly PowderVolume[] = [
  {
    suklCode: "0183925", product: "AZEPO 1 g prášek pro injekční/infuzní roztok", spc: "SPC233233.pdf",
    vialMg: 1000, diluentMl: 2.5, finalMl: 3, quote: AZEPO_QUOTE,
  },
  {
    suklCode: "0183925", product: "AZEPO 1 g prášek pro injekční/infuzní roztok", spc: "SPC233233.pdf",
    vialMg: 1000, diluentMl: 2.5, approxMgPerMl: 330, quote: AZEPO_QUOTE,
  },
  {
    suklCode: "0246093", product: "AMPICILIN BBP 0,5 g prášek pro injekční/infuzní roztok", spc: "SPC154508.pdf",
    vialMg: 500, diluentMl: 1.8, finalMl: 2, quote: AMPICILIN_QUOTE,
  },
  {
    suklCode: "0246096", product: "AMPICILIN BBP 1 g prášek pro injekční/infuzní roztok", spc: "SPC154505.pdf",
    vialMg: 1000, diluentMl: 3.5, finalMl: 4, quote: AMPICILIN_QUOTE,
  },
  {
    suklCode: "0273263", product: "Fortum 500 mg prášek pro injekční roztok", spc: "SPC221078.pdf",
    vialMg: 500, diluentMl: 1.5, approxMgPerMl: 260, quote: FORTUM_QUOTE,
  },
  {
    suklCode: "0273263", product: "Fortum 500 mg prášek pro injekční roztok", spc: "SPC221078.pdf",
    vialMg: 500, diluentMl: 5, approxMgPerMl: 90, quote: FORTUM_QUOTE,
  },
  {
    suklCode: "0273266", product: "Fortum 1 g prášek pro injekční roztok", spc: "SPC221075.pdf",
    vialMg: 1000, diluentMl: 3, approxMgPerMl: 260, quote: FORTUM_QUOTE,
  },
  {
    suklCode: "0273266", product: "Fortum 1 g prášek pro injekční roztok", spc: "SPC221075.pdf",
    vialMg: 1000, diluentMl: 10, approxMgPerMl: 90, quote: FORTUM_QUOTE,
  },
  {
    suklCode: "0064834", product: "AXETINE 750 mg prášek pro injekční/infuzní roztok", spc: "SPC228377.pdf",
    vialMg: 750, diluentMl: 3, approxMgPerMl: 216, quote: AXETINE_QUOTE,
  },
  {
    suklCode: "0064834", product: "AXETINE 750 mg prášek pro injekční/infuzní roztok", spc: "SPC228377.pdf",
    vialMg: 750, diluentMl: 6, approxMgPerMl: 116, quote: AXETINE_QUOTE,
  },
  {
    suklCode: "0064830", product: "AXETINE 1,5 g prášek pro injekční/infuzní roztok", spc: "SPC228375.pdf",
    vialMg: 1500, diluentMl: 6, approxMgPerMl: 216, quote: AXETINE_QUOTE,
  },
  {
    suklCode: "0064830", product: "AXETINE 1,5 g prášek pro injekční/infuzní roztok", spc: "SPC228375.pdf",
    vialMg: 1500, diluentMl: 15, approxMgPerMl: 94, quote: AXETINE_QUOTE,
  },
  {
    suklCode: "0121237", product: "Ceftriaxon Kabi 1 g prášek pro injekční/infuzní roztok", spc: "SPC212156.pdf",
    vialMg: 1000, diluentMl: 3, approxMgPerMl: 285, quote: CEFTRIAXON_QUOTE,
  },
];

export function powderVolumeSource(item: PowderVolume): Source {
  return {
    citation: `SÚKL, SPC přípravku ${item.product}, bod 6.6: „${item.quote}“`,
    url: "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics",
    suklCode: item.suklCode,
    verifiedAt: VERIFIED_AT,
  };
}
