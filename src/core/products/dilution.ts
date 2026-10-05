import type { Source } from "../types";

/**
 * Výsledná koncentrace po naředění podle SPC (body 4.2 a 6.6).
 *
 * Proč tahle tabulka existuje: úlohy na ředění (D1, D4, D6) dřív braly
 * jakýkoli koncentrát z fondu a jakýkoli vak. Každé číslo bylo pravdivé,
 * ale dohromady vycházelo „0,5 ml topotekanu do 1000 ml“ (0,5 µg/ml,
 * SPC chce 25–50 µg/ml) nebo docetaxel pod koncentrací, kterou SPC
 * dovoluje. Teď se ředí jen přípravky, u kterých SPC výslednou
 * koncentraci uvádí, a jen do ní.
 *
 * U cytostatik musí sedět i množství léku (`doseMg`), ne jen koncentrace:
 * 5 ml paklitaxelu do 50 ml má koncentraci podle SPC, ale 30 mg nikdo
 * nepodá. Fond zná u každé látky jednu lahvičku, a tak paklitaxel
 * (175 mg/m² ≈ 300 mg), oxaliplatina a doxorubicin reálnou dávku z ní
 * nesloží a v ředění nejsou; jejich dávky se počítají v C3 a L2. Abelcet
 * se dávkuje podle hmotnosti (5 mg/kg), kterou úloha na ředění nezná.
 * Topotecan Accord je ve fondu jen jako lahvička 1 mg, menší než dávka
 * (1,2–3 mg); topotekan proto zastupuje Topotecan Hospira 4 mg/4 ml.
 *
 * Vynechané jsou i koncentráty, jejichž SPC uvádí jen horní mez (aciklovir,
 * karboplatina, docetaxel Ebewe), jen objem vaku k dávce (pemetrexed,
 * bendamustin, vinorelbin, gemcitabin), nebo nic (noradrenalin,
 * dopamin, cytarabin, irinotekan, cisplatina, ciprofloxacin, levetiracetam).
 * U Ardeaelytosolu, Taxotere a Onivyde se text SPC nedal spolehlivě
 * přečíst, a tak tu také nejsou.
 *
 * Ověřeno 5. 10. 2026 v archivu SÚKL SPC20260827.zip, Topotecan Hospira
 * v informacích o přípravku EMA.
 */
export type DilutionRule = {
  /** Kód SÚKL přípravku ve fondu. */
  suklCode: string;
  product: string;
  /** Soubor SPC v archivu SÚKL, nebo dokument EMA. */
  spc: string;
  /**
   * Výsledná koncentrace v mg/ml: rozmezí, nebo jednotlivé hodnoty, když
   * SPC uvádí jen je (etoposid „0,2 mg/ml nebo 0,4 mg/ml“).
   */
  mgPerMl: { min: number; max: number } | readonly number[];
  /** Celkový objem, uvádí-li ho SPC výslovně (Rapibloc 2 + 8 ml). */
  totalVolumesMl?: readonly number[];
  /**
   * Kolik léku smí v ředění být, v mg. U cytostatik z dávky v mg/m² ze SPC
   * pro povrch těla 1,6–2,0 m² (návrhové rozhodnutí, běžný dospělý),
   * u klindamycinu z tabulky ředění.
   */
  doseMg?: { min: number; max: number };
  quotes: readonly { section: string; text: string }[];
};

/** Molární hmotnost KCl, g/mol. Meze draslíku jsou v SPC v mmol/l. */
const KCL_MG_PER_MMOL = 74.55;

const KCL_RANGE = { min: (20 * KCL_MG_PER_MMOL) / 1000, max: (40 * KCL_MG_PER_MMOL) / 1000 };

export const DILUTION_RULES: readonly DilutionRule[] = [
  {
    suklCode: "0167723", product: "Topotecan Hospira 4 mg/4 ml koncentrát pro infuzní roztok",
    spc: "EMA: topotecan-hospira-epar-product-information_cs.pdf",
    mgPerMl: { min: 0.025, max: 0.05 },
    // 0,75–1,5 mg/m² × 1,6–2,0 m²
    doseMg: { min: 1.2, max: 3 },
    quotes: [{
      section: "4.2",
      text: "Doporučená dávka topotekanu je 1,5 mg/m2 tělesného povrchu/den. … Karcinom děložního hrdla: " +
        "Doporučená dávka topotekanu je 0,75 mg/m2/den.",
    }, {
      section: "6.6",
      text: "Pro dosažení konečné koncentrace 25 až 50 mikrogramů/ml je před použitím nutné další naředění buď " +
        "roztokem chloridu sodného 9 mg/ml (0,9%) nebo roztokem glukózy 50 mg/ml (5%).",
    }],
  },
  {
    suklCode: "0011389", product: "Etoposide Teva 20 mg/ml koncentrát pro infuzní roztok", spc: "SPC207169.pdf",
    mgPerMl: [0.2, 0.4],
    // 50–100 mg/m² × 1,6–2,0 m²
    doseMg: { min: 80, max: 200 },
    quotes: [{
      section: "4.2",
      text: "Doporučená dávka přípravku Etoposide Teva u dospělých pacientů je 50 až 100 mg/m2/den.",
    }, {
      section: "6.6",
      text: "Přípravek Etoposide Teva se ředí 5% roztokem glukosy pro intravenózní podání nebo 0,9% roztokem " +
        "chloridu sodného pro intravenózní podání tak, aby výsledná koncentrace činila 0,2 mg/ml nebo 0,4 mg/ml.",
    }],
  },
  {
    suklCode: "0223854", product: "Amiodaron hameln 50 mg/ml injekční roztok", spc: "SPC186924.pdf",
    mgPerMl: [0.6],
    quotes: [{
      section: "6.6",
      text: "Výsledná koncentrace, která podle doporučení vznikne ředěním jedné ampulky přípravku Amiodaron hameln " +
        "s 250 ml glukózy 5 %, je amiodaron-hydrochlorid 0,6 mg/ml.",
    }],
  },
  {
    suklCode: "0179078", product: "Asicord 1 mg/ml koncentrát pro infúzní roztok", spc: "SPC156443.pdf",
    mgPerMl: [0.2],
    quotes: [{
      section: "4.2",
      text: "Následující tabulka ukazuje rychlost udržovací infúze pro roztok o koncentraci 200 µg/ml připravený " +
        "přidáním 400 ml rozpouštědla na 100 ml injekčního roztoku (40 ml rozpuštědla na 10 ml ampuli nebo 80 ml " +
        "na 20 ml ampuli).",
    }],
  },
  {
    // Dolní mez je nejředší řádek tabulky v bodu 6.6 (300 mg v 50 ml).
    suklCode: "0129833", product: "Clindamycin Kabi 150 mg/ml injekční roztok/koncentrát pro infuzní roztok",
    spc: "SPC178631.pdf",
    mgPerMl: { min: 6, max: 18 },
    doseMg: { min: 300, max: 1200 },
    quotes: [
      { section: "4.2", text: "Koncentrace nesmí být větší než 18 mg klindamycinu na ml roztoku." },
      { section: "6.6", text: "Dávka: Roztok k ředění: 300 mg 50 ml, 600 mg 50 ml, 900 mg 50-100 ml, 1200 mg 100 ml." },
    ],
  },
  {
    suklCode: "0155338", product: "Simdax 2,5 mg/ml koncentrát pro infuzní roztok", spc: "SPC226679.pdf",
    mgPerMl: [0.025, 0.05],
    totalVolumesMl: [500],
    quotes: [{
      section: "6.6",
      text: "K přípravě infuze o koncentraci 0,025 mg/ml smíchejte 5 ml přípravku Simdax 2,5 mg/ml s 500 ml 5% " +
        "roztoku glukózy. … K přípravě infuze o koncentraci 0,05 mg/ml smíchejte 10 ml přípravku Simdax 2,5 mg/ml " +
        "s 500 ml 5% roztoku glukózy.",
    }],
  },
  {
    suklCode: "0298011", product: "Rapibloc 20 mg/2 ml koncentrát pro injekční/infuzní roztok", spc: "SPC236477.pdf",
    mgPerMl: [2],
    totalVolumesMl: [10],
    quotes: [{
      section: "6.6",
      text: "Roztok 2 mg/ml připravte naředěním 2 ml koncentrátu s 8 ml jednoho z následujících roztoků.",
    }],
  },
  {
    suklCode: "0286679", product: "Kalium chloratum Noridem 150 mg/ml koncentrát pro infuzní roztok",
    spc: "SPC232091.pdf",
    mgPerMl: KCL_RANGE,
    quotes: [
      {
        section: "4.2",
        text: "Před použitím nařeďte vhodným infuzním roztokem a dobře promíchejte, aby se dosáhlo koncentrace " +
          "draslíku 20 mmol/l a ne více než 40 mmol/l.",
      },
      {
        section: "6.6",
        text: "Koncentrát chloridu draselného musí být před použitím naředěn nejméně 50násobkem svého objemu.",
      },
    ],
  },
  {
    suklCode: "0107677", product: "Kaliumchlorid 7,45% B. Braun koncentrát pro infuzní roztok", spc: "SPC189753.pdf",
    mgPerMl: KCL_RANGE,
    quotes: [{
      section: "4.2",
      text: "Pro děti musí být roztok před podáním naředěn na koncentraci 20–40 mmol KCl/l. … Koncentrace kalia " +
        "v infuzním roztoku nesmí normálně překročit 40 mmol/l.",
    }],
  },
];

const VERIFIED_AT = "2026-10-05";

/**
 * Hodnoty v SPC jsou zaokrouhlené: ampule amiodaronu (3 ml) v 250 ml dá
 * 0,59 mg/ml a SPC píše 0,6, 20 mmol/l je 1,491 mg/ml a 10 ml 7,45% KCl
 * v 500 ml 1,49. Proto 2 %.
 */
const TOLERANCE = 0.02;

export function dilutionRuleFor(code: string): DilutionRule | undefined {
  return DILUTION_RULES.find((rule) => rule.suklCode === code);
}

/** Smí výsledná koncentrace podle SPC vyjít takhle? */
export function concentrationAllowed(rule: DilutionRule, mgPerMl: number): boolean {
  const spec = rule.mgPerMl;
  if ("min" in spec) {
    return mgPerMl >= spec.min * (1 - TOLERANCE) && mgPerMl <= spec.max * (1 + TOLERANCE);
  }
  return spec.some((value) => Math.abs(mgPerMl - value) <= value * TOLERANCE);
}

export function dilutionSource(rule: DilutionRule): Source {
  const url = rule.spc.startsWith("EMA:")
    ? "https://www.ema.europa.eu/cs/documents/product-information/" + rule.spc.slice(4).trim()
    : "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics";
  const parts = rule.quotes.map((quote) => `bod ${quote.section}: „${quote.text}“`);
  return {
    citation: `SPC přípravku ${rule.product}, ${parts.join("; ")}`,
    url,
    suklCode: rule.suklCode,
    verifiedAt: VERIFIED_AT,
  };
}
