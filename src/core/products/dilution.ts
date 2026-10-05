import type { Source } from "../types";

/**
 * Ředění podle SPC: do jaké koncentrace, do jakého objemu a kolik léku.
 *
 * Proč tahle tabulka existuje: úlohy na ředění (D1, D4, D6) dřív braly
 * jakýkoli koncentrát z fondu a jakýkoli vak. Každé číslo bylo pravdivé,
 * ale dohromady vycházelo „0,5 ml topotekanu do 1000 ml“ (0,5 µg/ml,
 * SPC chce 25–50 µg/ml) nebo 30 mg paklitaxelu. Teď se ředí jen to, co
 * popisuje SPC, a jen tak, jak ho popisuje.
 *
 * Pravidlo platí, když z něj jde poznat, co se reálně namíchá: buď SPC
 * dává výslednou koncentraci (rozmezí nebo jednotlivé hodnoty), nebo
 * objem, do kterého se ředí, a dávku, která se do něj dává. Kde SPC dává
 * jen horní mez koncentrace, musí být známá i dávka.
 *
 * Přípravek v příkladu je vždy ten, z jehož SPC údaj pochází — u látky,
 * kterou má fond od jiného výrobce, se v příkladu objeví jiný přípravek
 * (noradrenalin Zentiva místo Léčiva, protože jen jeho SPC uvádí tabulku
 * ředění). Jediná výjimka je dopamin: žádné české SPC ředění neuvádí,
 * a tak je převzaté z britského SPC přípravku se stejnou silou a lékovou
 * formou (40 mg/ml koncentrát) a citace to říká.
 *
 * Návrhová rozhodnutí, ne údaje ze zdroje: dávka v mg/m² se převádí na mg
 * pro povrch těla 1,6–2,0 m², dávka v mg/kg pro hmotnost 60–90 kg (běžný
 * dospělý). Kde SPC objem neuvádí, ředí se do vaků 50/100/250/500 ml
 * (D4 i 1000 ml).
 *
 * Vynechané: gentamicin (SPC chce nejvýš 1 mg/ml ve 100 ml, doporučená
 * dávka jednou denně se do toho nevejde), karboplatina (0,5 mg/ml dává
 * u reálné dávky vak přes litr), cisplatina (podává se s hydratací 2–4 l),
 * oktreotid (SPC ředí „ampulku s 0,5 mg“, registrovaná je jen 0,1 mg),
 * metamizol a další, u kterých SPC jen říká čím ředit, ne kolik.
 *
 * Ověřeno 5. 10. 2026: archiv SÚKL SPC20260827.zip, Topotecan Hospira
 * v informacích o přípravku EMA, dopamin v EMC (medicines.org.uk).
 */
export type DilutionRule = {
  /** Kód SÚKL přípravku v příkladu. */
  suklCode: string;
  /** Název jako v databázi léčiv (DLP), tak se ukáže v zadání. */
  name: string;
  substance: string;
  /** Název přípravku tak, jak ho uvádí SPC. */
  product: string;
  /** Soubor SPC v archivu SÚKL, dokument EMA, nebo stránka EMC. */
  spc: string;
  /** Síla koncentrátu v mg/ml. */
  mgPerMlStock: number;
  /** Objemy balení v ml podle DLP. */
  vialsMl: readonly number[];
  /** Nejvíc lahviček do jednoho ředění; bez údaje tři. */
  maxVials?: number;
  /** Nejvíc mililitrů natažených do jednoho ředění; bez údaje 40. */
  maxDrawMl?: number;
  /**
   * Výsledná koncentrace v mg/ml: rozmezí, nebo jednotlivé hodnoty, když
   * SPC uvádí jen je (noradrenalin 40 mg/l).
   */
  mgPerMl?: { min: number; max: number } | readonly number[];
  /** Horní mez koncentrace, když SPC uvádí jen ji. */
  maxMgPerMl?: number;
  /** Celkový objem, uvádí-li ho SPC (Rapibloc 2 + 8 ml, pemetrexed do 100 ml). */
  totalVolumesMl?: readonly number[];
  /** Kolik léku smí v ředění být, v mg (z dávky v bodu 4.2). */
  doseMg?: { min: number; max: number };
  /** Ředí se aspoň tolikrát; bez údaje čtyřikrát. Tramadol podle tabulky SPC i 1 + 1 ml. */
  minDilution?: number;
  quotes: readonly { section: string; text: string }[];
};

/** Molární hmotnost KCl, g/mol. Meze draslíku jsou v SPC v mmol/l. */
const KCL_MG_PER_MMOL = 74.55;

const KCL_RANGE = { min: (20 * KCL_MG_PER_MMOL) / 1000, max: (40 * KCL_MG_PER_MMOL) / 1000 };

/** Povrch těla běžného dospělého, m². Návrhové rozhodnutí. */
const BSA = { min: 1.6, max: 2 } as const;
/** Hmotnost běžného dospělého, kg. Návrhové rozhodnutí. */
const WEIGHT = { min: 60, max: 90 } as const;

const perM2 = (min: number, max: number) => ({ min: min * BSA.min, max: max * BSA.max });

export const DILUTION_RULES: readonly DilutionRule[] = [
  // ——— oběh, JIP ———
  {
    suklCode: "0277595", name: "NOREPINEPHRINE ZENTIVA", substance: "NOREPINEFRIN",
    product: "Norepinephrine Zentiva 1 mg/ml koncentrát pro infuzní roztok", spc: "SPC227762.pdf",
    mgPerMlStock: 1, vialsMl: [1, 4, 10],
    mgPerMl: [0.04], totalVolumesMl: [25, 50, 100, 250, 500],
    quotes: [
      {
        section: "4.2",
        text: "Doporučená konečná koncentrace infuzního roztoku norepinefrin-tartarátu je 80 mg/l, což odpovídá " +
          "40 mg/l norepinefrinu.",
      },
      {
        section: "6.6",
        text: "Poměry ředění (např.): Přidejte 1 ml koncentrátu do 24 ml roztoku. … Přidejte 20 ml koncentrátu " +
          "do 480 ml roztoku.",
      },
    ],
  },
  {
    suklCode: "0253208", name: "DOBUTAMIN ADMEDA", substance: "DOBUTAMIN",
    product: "Dobutamin Admeda 5 mg/ml infuzní roztok", spc: "SPC230995.pdf",
    mgPerMlStock: 5, vialsMl: [50], maxDrawMl: 50,
    mgPerMl: { min: 0.5, max: 1 },
    quotes: [{
      section: "4.2",
      text: "Pro podání kontinuální intravenózní infuze přípravku Dobutamin Admeda za použití infuzní pumpy " +
        "nařeďte na koncentraci 0,5 až 1 mg/ml (maximálně 5 mg/ml pokud jsou tekutiny omezeny).",
    }],
  },
  {
    // Ředění z britského SPC: žádné české SPC dopaminu ho neuvádí. Tensamin
    // má stejnou sílu i lékovou formu (40 mg/ml, koncentrát pro infuzní roztok).
    suklCode: "0004380", name: "TENSAMIN", substance: "DOPAMIN",
    product: "Dopamine hydrochloride 40 mg/ml concentrate for solution for infusion (britské SPC, EMC)",
    spc: "EMC: https://www.medicines.org.uk/emc/product/100811/smpc",
    mgPerMlStock: 40, vialsMl: [5],
    mgPerMl: [0.4, 0.8, 1.6], totalVolumesMl: [250, 500],
    quotes: [{
      section: "6.6",
      text: "Dilution: … 200 mg/5 ml: 5 ml + 500 ml = 400 microgram/ml; 5 ml + 250 ml = 800 microgram/ml; " +
        "10 ml + 250 ml = 1600 microgram/ml; 20 ml + 500 ml = 1600 microgram/ml.",
    }],
  },
  {
    suklCode: "0223854", name: "AMIODARON HAMELN", substance: "AMIODARON",
    product: "Amiodaron hameln 50 mg/ml injekční roztok", spc: "SPC186924.pdf",
    mgPerMlStock: 50, vialsMl: [3],
    mgPerMl: [0.6],
    quotes: [{
      section: "6.6",
      text: "Výsledná koncentrace, která podle doporučení vznikne ředěním jedné ampulky přípravku Amiodaron hameln " +
        "s 250 ml glukózy 5 %, je amiodaron-hydrochlorid 0,6 mg/ml.",
    }],
  },
  {
    suklCode: "0179078", name: "ASICORD", substance: "MILRINON",
    product: "Asicord 1 mg/ml koncentrát pro infúzní roztok", spc: "SPC156443.pdf",
    mgPerMlStock: 1, vialsMl: [10, 20],
    mgPerMl: [0.2],
    quotes: [{
      section: "4.2",
      text: "Následující tabulka ukazuje rychlost udržovací infúze pro roztok o koncentraci 200 µg/ml připravený " +
        "přidáním 400 ml rozpouštědla na 100 ml injekčního roztoku (40 ml rozpuštědla na 10 ml ampuli nebo 80 ml " +
        "na 20 ml ampuli).",
    }],
  },
  {
    suklCode: "0155338", name: "SIMDAX", substance: "LEVOSIMENDAN",
    product: "Simdax 2,5 mg/ml koncentrát pro infuzní roztok", spc: "SPC226679.pdf",
    mgPerMlStock: 2.5, vialsMl: [5],
    mgPerMl: [0.025, 0.05], totalVolumesMl: [500],
    quotes: [{
      section: "6.6",
      text: "K přípravě infuze o koncentraci 0,025 mg/ml smíchejte 5 ml přípravku Simdax 2,5 mg/ml s 500 ml 5% " +
        "roztoku glukózy. … K přípravě infuze o koncentraci 0,05 mg/ml smíchejte 10 ml přípravku Simdax 2,5 mg/ml " +
        "s 500 ml 5% roztoku glukózy.",
    }],
  },
  {
    suklCode: "0298011", name: "RAPIBLOC", substance: "LANDIOLOL",
    product: "Rapibloc 20 mg/2 ml koncentrát pro injekční/infuzní roztok", spc: "SPC236477.pdf",
    mgPerMlStock: 10, vialsMl: [2],
    mgPerMl: [2], totalVolumesMl: [10],
    quotes: [{
      section: "6.6",
      text: "Roztok 2 mg/ml připravte naředěním 2 ml koncentrátu s 8 ml jednoho z následujících roztoků.",
    }],
  },
  {
    suklCode: "0290344", name: "EPANUTIN PARENTERAL", substance: "FENYTOIN",
    product: "Epanutin Parenteral 250 mg/5 ml injekční roztok", spc: "SPC231713.pdf",
    mgPerMlStock: 50, vialsMl: [5], maxVials: 4,
    // Nasycovací 10–15 mg/kg pro 60–90 kg, nejvýš tolik, kolik se při 10 mg/ml vejde do 100 ml.
    maxMgPerMl: 10, totalVolumesMl: [50, 100],
    doseMg: { min: 10 * WEIGHT.min, max: 1000 },
    quotes: [
      {
        section: "4.2",
        text: "Podání v infuzi: pro infuzní podání se fenytoin naředí v 50–100 ml fyziologického roztoku " +
          "na konečnou koncentraci fenytoinu, maximálně 10 mg/ml.",
      },
      {
        section: "4.2",
        text: "Status epilepticus: u dospělých pacientů se nasycovací dávka 10 – 15 mg/kg podává pomalu intravenózně.",
      },
    ],
  },
  {
    suklCode: "0283515", name: "LEVETIRACETAM KALCEKS", substance: "LEVETIRACETAM",
    product: "Levetiracetam Kalceks 100 mg/ml koncentrát pro infuzní roztok", spc: "SPC231307.pdf",
    mgPerMlStock: 100, vialsMl: [5],
    totalVolumesMl: [100], doseMg: { min: 250, max: 1500 },
    quotes: [
      {
        section: "4.2",
        text: "Doporučená dávka musí být naředěna v nejméně 100 ml kompatibilního ředicího roztoku a podána " +
          "intravenózně formou 15minutové infuze.",
      },
      {
        section: "4.2",
        text: "Úvodní terapeutická dávka je 500 mg dvakrát denně. … nižší úvodní dávka 250 mg dvakrát denně. … " +
          "lze denní dávku zvýšit až na 1 500 mg dvakrát denně.",
      },
    ],
  },
  {
    suklCode: "0224478", name: "MIDAZOLAM KALCEKS", substance: "MIDAZOLAM",
    product: "Midazolam Kalceks 5 mg/ml injekční/infuzní roztok", spc: "SPC228301.pdf",
    mgPerMlStock: 5, vialsMl: [3],
    mgPerMl: { min: 0.015, max: 0.15 }, totalVolumesMl: [100, 250, 500, 1000], doseMg: { min: 15, max: 15 },
    quotes: [{
      section: "6.6",
      text: "Pro intravenózní infuzi lze obsah ampulky přípravku Midazolam Kalceks naředit jedním z výše uvedených " +
        "roztoků v poměru 15 mg midazolamu na 100 až 1 000 ml infuzního roztoku.",
    }],
  },
  // ——— elektrolyty ———
  {
    suklCode: "0286679", name: "KALIUM CHLORATUM NORIDEM 15%", substance: "CHLORID DRASELNÝ",
    product: "Kalium chloratum Noridem 150 mg/ml koncentrát pro infuzní roztok", spc: "SPC232091.pdf",
    mgPerMlStock: 150, vialsMl: [5, 10, 20],
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
    suklCode: "0107677", name: "KALIUMCHLORID B. BRAUN 7,45%", substance: "CHLORID DRASELNÝ",
    product: "Kaliumchlorid 7,45% B. Braun koncentrát pro infuzní roztok", spc: "SPC189753.pdf",
    mgPerMlStock: 74.5, vialsMl: [20, 100],
    mgPerMl: KCL_RANGE,
    quotes: [{
      section: "4.2",
      text: "Pro děti musí být roztok před podáním naředěn na koncentraci 20–40 mmol KCl/l. … Koncentrace kalia " +
        "v infuzním roztoku nesmí normálně překročit 40 mmol/l.",
    }],
  },
  {
    suklCode: "0231544", name: "MAGNESIUM SULFATE KALCEKS", substance: "SÍRAN HOŘEČNATÝ",
    product: "Magnesium sulfate Kalceks 200 mg/ml injekční/infuzní roztok", spc: "SPC191610.pdf",
    mgPerMlStock: 200, vialsMl: [10],
    mgPerMl: [16], totalVolumesMl: [250], doseMg: { min: 4000, max: 4000 },
    quotes: [{
      section: "4.2",
      text: "Těžká preeklampsie nebo eklampsie: Počáteční nasycovací dávka 4 g intravenózně zředěná na přiměřený " +
        "objem, např. 4 g síranu hořečnatého v 250 ml 5% roztoku glukózy nebo 0,9% roztoku chloridu sodného.",
    }],
  },
  // ——— diuretika, analgetika, antiemetika, bronchodilatancia ———
  {
    suklCode: "0251020", name: "FUROSEMIDE KALCEKS", substance: "FUROSEMID",
    product: "Furosemide Kalceks 10 mg/ml injekční/infuzní roztok", spc: "SPC213982.pdf",
    mgPerMlStock: 10, vialsMl: [2, 4],
    mgPerMl: { min: 0.02, max: 3 }, doseMg: { min: 20, max: 40 },
    quotes: [
      { section: "4.2", text: "Počáteční dávka 2-4 ml (odpovídající 20-40 mg furosemidu) intravenózně." },
      {
        section: "6.6",
        text: "Ukázalo se, že furosemid je kompatibilní s injekčními stříkačkami … a vaky …, pokud jsou naředěny " +
          "na koncentraci 0,02 až 3 mg/ml s výše uvedenými injekčními roztoky.",
      },
    ],
  },
  {
    suklCode: "0250749", name: "ONDANSETRON KALCEKS", substance: "ONDANSETRON",
    product: "Ondansetron Kalceks 2 mg/ml injekční/infuzní roztok", spc: "SPC194025.pdf",
    mgPerMlStock: 2, vialsMl: [2, 4],
    totalVolumesMl: [50, 100], doseMg: { min: 8, max: 16 },
    quotes: [{
      section: "4.2",
      text: "Intravenózní dávky vyšší než 8 mg až do maximální dávky 16 mg ondansetronu musí být naředěné " +
        "v 50-100 ml roztoku chloridu sodného 9 mg/ml (0,9%) nebo v infuzním roztoku glukózy 50 mg/ml (5 %).",
    }],
  },
  {
    suklCode: "0135598", name: "GRANISETRON KABI", substance: "GRANISETRON",
    product: "Granisetron Kabi 1 mg/ml injekční roztok", spc: "SPC167273.pdf",
    mgPerMlStock: 1, vialsMl: [1, 3],
    mgPerMl: [0.2], totalVolumesMl: [5, 10, 15], doseMg: { min: 1, max: 3 },
    quotes: [{
      section: "4.2",
      text: "Před zahájením chemoterapie se dávka 1-3 mg (10-40 µg/kg) přípravku Granisetron Kabi podává buď " +
        "pomalou intravenózní injekcí nebo naředěný v intravenózní infuzi po dobu 5 minut. … Roztok má být " +
        "naředěn na 5 ml/mg.",
    }],
  },
  {
    suklCode: "0248525", name: "METOCLOPRAMIDE NORIDEM", substance: "METOKLOPRAMID",
    product: "Metoclopramide Noridem 5 mg/ml injekční roztok", spc: "SPC235298.pdf",
    mgPerMlStock: 5, vialsMl: [2],
    mgPerMl: [0.1], doseMg: { min: 10, max: 10 },
    quotes: [
      { section: "4.2", text: "K symptomatické léčbě nauzey a zvracení … se doporučuje podat dávku 10 mg." },
      {
        section: "6.6",
        text: "Metoclopramide Noridem lze přimíchat/ředit do 0,9% roztoku chloridu sodného, do 5% glukózy, … " +
          "na konečnou koncentraci Metoclopramidu Noridem 0,1 mg/ml.",
      },
    ],
  },
  {
    suklCode: "0218930", name: "DEKENOR", substance: "DEXKETOPROFEN",
    product: "Dekenor 50 mg/2 ml injekční/infuzní roztok", spc: "SPC228604.pdf",
    mgPerMlStock: 25, vialsMl: [2],
    totalVolumesMl: [50, 100], doseMg: { min: 50, max: 50 },
    quotes: [
      { section: "4.2", text: "Doporučená dávka je 50 mg každých 8–12 hodin." },
      {
        section: "6.6",
        text: "Pro podání nitrožilní infuzí se má obsah jedné ampule (2 ml) přípravku Dekenor injekční/infuzní " +
          "roztok rozpustit v objemu od 30 do 100 ml fyziologického roztoku, glukózy nebo roztoku Ringer-laktátu.",
      },
    ],
  },
  {
    suklCode: "0201134", name: "TRAMAL", substance: "TRAMADOL",
    product: "Tramal 50 mg/1 ml injekční roztok", spc: "SPC225540.pdf",
    mgPerMlStock: 50, vialsMl: [1, 2],
    mgPerMl: { min: 5, max: 25 }, totalVolumesMl: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20],
    doseMg: { min: 50, max: 100 }, minDilution: 2,
    quotes: [
      { section: "4.2", text: "Dospělí a dospívající od 12 let 50 – 100 mg tramadol-hydrochloridu po 4 – 6 hodinách." },
      {
        section: "6.6",
        text: "Tabulka: Ředění přípravku TRAMAL ve formě injekčního roztoku: 1 ml + 1 ml (2 ml + 2 ml) 25,0 mg/ml; " +
          "… 1 ml + 4 ml (2 ml + 8 ml) 10,0 mg/ml; … 1 ml + 9 ml (2 ml + 18 ml) 5,0 mg/ml.",
      },
    ],
  },
  {
    suklCode: "0231857", name: "BRICANYL", substance: "TERBUTALIN",
    product: "Bricanyl 0,5 mg/ml injekční roztok", spc: "SPC163105.pdf",
    mgPerMlStock: 0.5, vialsMl: [1],
    totalVolumesMl: [10], doseMg: { min: 0.25, max: 0.5 },
    quotes: [{
      section: "4.2",
      text: "Dospělí: 0,25-0,5 mg terbutalin sulfátu (0,5-1 ml) v pomalé intravenózní injekci. … Injekční roztok " +
        "se doplní sterilním fyziologickým roztokem do 10 ml a podává se pomalou intravenózní injekcí.",
    }],
  },
  // ——— antibiotika ———
  {
    // Dolní mez je nejředší řádek tabulky v bodu 6.6 (300 mg v 50 ml).
    suklCode: "0129833", name: "CLINDAMYCIN KABI", substance: "KLINDAMYCIN",
    product: "Clindamycin Kabi 150 mg/ml injekční roztok/koncentrát pro infuzní roztok", spc: "SPC178631.pdf",
    mgPerMlStock: 150, vialsMl: [2, 4, 6],
    mgPerMl: { min: 6, max: 18 }, doseMg: { min: 300, max: 1200 },
    quotes: [
      { section: "4.2", text: "Koncentrace nesmí být větší než 18 mg klindamycinu na ml roztoku." },
      { section: "6.6", text: "Dávka: Roztok k ředění: 300 mg 50 ml, 600 mg 50 ml, 900 mg 50-100 ml, 1200 mg 100 ml." },
    ],
  },
  {
    suklCode: "0231464", name: "AMIKACIN OLIKLA", substance: "AMIKACIN",
    product: "Amikacin Olikla 250 mg/ml injekční/infuzní roztok", spc: "SPC232412.pdf",
    mgPerMlStock: 250, vialsMl: [2],
    // 15 mg/kg/den jednou denně pro 60–90 kg, nejvýš 1,5 g
    totalVolumesMl: [100, 200], doseMg: { min: 15 * WEIGHT.min, max: 15 * WEIGHT.max },
    quotes: [
      {
        section: "4.2",
        text: "U dospělých a dospívajících s normální funkcí ledvin je doporučená dávka 15 mg/kg/den i.v. … " +
          "Celková denní dávka nemá překročit 1,5 g.",
      },
      {
        section: "6.6",
        text: "Roztok pro intravenózní použití se připraví přidáním požadované dávky do 100 ml nebo 200 ml " +
          "sterilního rozpouštědla.",
      },
    ],
  },
  // ——— onkologie: dávka v mg/m² pro povrch 1,6–2,0 m² ———
  {
    suklCode: "0131859", name: "PACLITAXEL KABI", substance: "PAKLITAXEL",
    product: "Paclitaxel Kabi 6 mg/ml koncentrát pro infuzní roztok", spc: "SPC192788.pdf",
    mgPerMlStock: 6, vialsMl: [5, 16.7, 25, 50, 100], maxDrawMl: 60,
    mgPerMl: { min: 0.3, max: 1.2 }, totalVolumesMl: [250, 500], doseMg: perM2(135, 175),
    quotes: [
      {
        section: "4.2",
        text: "Paklitaxel 175 mg/m2 podávaný intravenózně po dobu 3 hodin … nebo paklitaxel 135 mg/m2 jako " +
          "24hodinová infuze.",
      },
      { section: "6.6", text: "Před infuzním podáním musí být paklitaxel asepticky naředěn … do konečné koncentrace 0,3–1,2 mg/ml." },
    ],
  },
  {
    suklCode: "0142874", name: "DOCETAXEL EBEWE", substance: "DOCETAXEL",
    product: "Docetaxel Ebewe 10 mg/ml koncentrát pro infuzní roztok", spc: "SPC205826.pdf",
    mgPerMlStock: 10, vialsMl: [2, 8, 16],
    maxMgPerMl: 0.74, totalVolumesMl: [250], doseMg: perM2(75, 75),
    quotes: [
      { section: "4.2", text: "Doporučená dávka docetaxelu 75 mg/m2 podaného v jednohodinové infuzi." },
      {
        section: "6.6",
        text: "Potřebný objem přípravku Docetaxel Ebewe se musí injikovat jedinou injekcí (jeden bolus) do infuzního " +
          "vaku nebo infuzní lahve o objemu 250 ml … tak, aby koncentrace docetaxelu nepřekročila 0,74 mg/ml.",
      },
    ],
  },
  {
    suklCode: "0239968", name: "OXALIPLATIN ACCORD", substance: "OXALIPLATINA",
    product: "Oxaliplatin Accord 5 mg/ml koncentrát pro infuzní roztok", spc: "SPC222880.pdf",
    mgPerMlStock: 5, vialsMl: [10, 20, 40],
    mgPerMl: { min: 0.2, max: 0.7 }, totalVolumesMl: [250, 500], doseMg: perM2(85, 85),
    quotes: [
      { section: "4.2", text: "Doporučená dávka oxaliplatiny při pomocné léčbě je 85 mg/m² intravenózně." },
      {
        section: "4.2",
        text: "Oxaliplatina se podává formou 2-6 hodin trvající intravenózní infuze ve 250-500 ml 5% roztoku glukózy " +
          "k dosažení koncentrace mezi 0,2 mg/ml a 0,70 mg/ml.",
      },
    ],
  },
  {
    suklCode: "0139063", name: "DOXORUBICIN TEVA", substance: "DOXORUBICIN",
    product: "Doxorubicin Teva 2 mg/ml koncentrát pro infuzní roztok", spc: "SPC193970.pdf",
    mgPerMlStock: 2, vialsMl: [5, 10, 25, 100], maxDrawMl: 75,
    mgPerMl: { min: 0.05, max: 0.5 }, totalVolumesMl: [250, 500], doseMg: perM2(60, 75),
    quotes: [
      { section: "4.2", text: "Monoterapie: Doporučená dávka je 60-75 mg/m2 tělesného povrchu." },
      {
        section: "6.6",
        text: "Doxorubicin může být podáván jako intravenozní infuze, která je naředěná do non-PVC infuzního vaku " +
          "na koncentraci v rozmezí 0,05 mg/ml až 0,5 mg/ml.",
      },
    ],
  },
  {
    suklCode: "0242254", name: "GEMCITABINE ACCORD", substance: "GEMCITABIN",
    product: "Gemcitabine Accord 100 mg/ml koncentrát pro infuzní roztok", spc: "SPC217014.pdf",
    mgPerMlStock: 100, vialsMl: [2, 10, 15, 20],
    mgPerMl: { min: 0.1, max: 9 }, totalVolumesMl: [250, 500], doseMg: perM2(1000, 1250),
    quotes: [
      {
        section: "4.2",
        text: "Doporučená dávka gemcitabinu je 1000 mg/m2 podaných 30minutovou intravenózní infuzí. … Použití " +
          "v kombinaci: Doporučená dávka gemcitabinu je 1250 mg/m2 povrchu těla.",
      },
      {
        section: "4.2",
        text: "Celkové množství přípravku Gemcitabine Accord 100 mg/ml … je třeba naředit sterilním roztokem " +
          "chloridu sodného 9 mg/ml (0,9%) do konečné koncentrace 0,1 až 9 mg/ml.",
      },
    ],
  },
  {
    suklCode: "0242232", name: "ETOPOSIDE ACCORD", substance: "ETOPOSID",
    product: "Etoposide Accord 20 mg/ml koncentrát pro infuzní roztok", spc: "SPC207758.pdf",
    mgPerMlStock: 20, vialsMl: [5, 10, 12.5, 20, 25, 50],
    mgPerMl: { min: 0.2, max: 0.4 }, totalVolumesMl: [250, 500, 1000], doseMg: perM2(50, 100),
    quotes: [
      { section: "4.2", text: "Doporučená dávka etoposidu u dospělých pacientů je 50 až 100 mg/m2/den v den 1 až 5." },
      {
        section: "6.6",
        text: "Etoposide Accord je třeba před použitím naředit … na koncentraci 0,2 mg/ml (tedy 1 ml koncentrátu " +
          "na 100 ml ředícího roztoku) až 0,4 mg/ml (tedy 2 ml koncentrátu na 100 ml ředícího roztoku).",
      },
    ],
  },
  {
    suklCode: "0167723", name: "TOPOTECAN HOSPIRA", substance: "TOPOTEKAN",
    product: "Topotecan Hospira 4 mg/4 ml koncentrát pro infuzní roztok",
    spc: "EMA: topotecan-hospira-epar-product-information_cs.pdf",
    mgPerMlStock: 1, vialsMl: [4],
    mgPerMl: { min: 0.025, max: 0.05 }, doseMg: perM2(0.75, 1.5),
    quotes: [
      {
        section: "4.2",
        text: "Doporučená dávka topotekanu je 1,5 mg/m2 tělesného povrchu/den. … Karcinom děložního hrdla: " +
          "Doporučená dávka topotekanu je 0,75 mg/m2/den.",
      },
      {
        section: "6.6",
        text: "Pro dosažení konečné koncentrace 25 až 50 mikrogramů/ml je před použitím nutné další naředění buď " +
          "roztokem chloridu sodného 9 mg/ml (0,9%) nebo roztokem glukózy 50 mg/ml (5%).",
      },
    ],
  },
  {
    suklCode: "0241433", name: "VINORELBINE ACCORD", substance: "VINORELBIN",
    product: "Vinorelbine Accord 10 mg/ml koncentrát pro infuzní roztok", spc: "SPC221393.pdf",
    mgPerMlStock: 10, vialsMl: [1, 5],
    totalVolumesMl: [20, 50, 125], doseMg: perM2(25, 30),
    quotes: [
      { section: "4.2", text: "V monoterapii je obvyklá dávka 25-30 mg/m2 jednou týdně." },
      {
        section: "4.2",
        text: "Vinorelbine Accord může být podáván jako pomalý bolus (6-10 minut) po rozředění ve 20-50 ml " +
          "fyziologického roztoku nebo v 5% roztoku glukózy, nebo jako krátká infuze (20-30 minut) po rozředění " +
          "ve 125 ml.",
      },
    ],
  },
  {
    suklCode: "0242261", name: "IRINOTECAN ACCORDPHARMA", substance: "IRINOTEKAN",
    product: "Irinotecan Accordpharma 20 mg/ml koncentrát pro infuzní roztok", spc: "SPC205741.pdf",
    mgPerMlStock: 20, vialsMl: [2, 5, 15, 25, 50],
    totalVolumesMl: [250], doseMg: perM2(180, 350),
    quotes: [
      {
        section: "4.2",
        text: "Doporučená dávka trihydrát irinotekan-hydrochloridu je 350 mg/m2 … Doporučená dávka trihydrátu " +
          "irinotekan-hydrochloridu je 180 mg/m2 podaná každé 2 týdny.",
      },
      {
        section: "6.6",
        text: "Natáhněte požadovaný objem přípravku Irinotecan Accordpharma z injekční lahvičky … a vstříkněte " +
          "do 250 ml infuzního vaku nebo lahve.",
      },
    ],
  },
  {
    suklCode: "0244509", name: "PEMETREXED EVER PHARMA", substance: "PEMETREXED",
    product: "Pemetrexed EVER Pharma 25 mg/ml koncentrát pro infuzní roztok", spc: "SPC218220.pdf",
    mgPerMlStock: 25, vialsMl: [4, 20, 40],
    // Dávka 800–1000 mg je 32–40 ml; SPC ji ředí do 100 ml, tedy jen 2,5×.
    totalVolumesMl: [100], doseMg: perM2(500, 500), minDilution: 2.5,
    quotes: [
      { section: "4.2", text: "Doporučená dávka pemetrexedu je 500 mg/m2 plochy povrchu těla." },
      {
        section: "6.6",
        text: "Potřebný objem přípravku Pemetrexed EVER Pharma musí být naředěn do 100 ml injekčním roztokem " +
          "chloridu sodného o koncentraci 9 mg/ml (0,9%) … nebo 5% roztokem glukózy.",
      },
    ],
  },
  {
    suklCode: "0247777", name: "BENDAMUSTINE ACCORD", substance: "BENDAMUSTIN",
    product: "Bendamustine Accord 25 mg/ml koncentrát pro infuzní roztok", spc: "SPC212749.pdf",
    mgPerMlStock: 25, vialsMl: [1, 4],
    totalVolumesMl: [500], doseMg: perM2(100, 120),
    quotes: [
      {
        section: "4.2",
        text: "Bendamustin-hydrochlorid v dávce 100 mg/m2 plochy povrchu těla v den 1 a 2 … Bendamustin-hydrochlorid " +
          "v dávce 120 mg/m2 plochy povrchu těla v den 1 a 2.",
      },
      {
        section: "6.6",
        text: "Nařeďte celkovou doporučenou dávku přípravku Bendamustine Accord 25 mg/ml injekčním roztokem chloridu " +
          "sodného o koncentraci 9 mg/ml (0,9 %) tak, abyste získali konečný objem přibližně 500 ml.",
      },
    ],
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
  if (rule.maxMgPerMl !== undefined && mgPerMl > rule.maxMgPerMl * (1 + TOLERANCE)) return false;
  const spec = rule.mgPerMl;
  if (!spec) return true;
  if ("min" in spec) {
    return mgPerMl >= spec.min * (1 - TOLERANCE) && mgPerMl <= spec.max * (1 + TOLERANCE);
  }
  return spec.some((value) => Math.abs(mgPerMl - value) <= value * TOLERANCE);
}

/** Smí v ředění být tolik léku? */
export function doseAllowed(rule: DilutionRule, mg: number): boolean {
  if (!rule.doseMg) return true;
  return mg >= rule.doseMg.min - 1e-9 && mg <= rule.doseMg.max + 1e-9;
}

export function dilutionSource(rule: DilutionRule): Source {
  const parts = rule.quotes.map((quote) => `bod ${quote.section}: „${quote.text}“`);
  if (rule.spc.startsWith("EMC:")) {
    return {
      citation: `SPC přípravku ${rule.product}, ${parts.join("; ")} České SPC přípravku ${rule.name} ředění ` +
        "neuvádí; britský přípravek má stejnou sílu i lékovou formu.",
      url: rule.spc.slice(4).trim(),
      verifiedAt: VERIFIED_AT,
    };
  }
  const url = rule.spc.startsWith("EMA:")
    ? "https://www.ema.europa.eu/cs/documents/product-information/" + rule.spc.slice(4).trim()
    : "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics";
  return {
    citation: `SPC přípravku ${rule.product}, ${parts.join("; ")}`,
    url,
    suklCode: rule.suklCode,
    verifiedAt: VERIFIED_AT,
  };
}
