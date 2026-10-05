import type { Source } from "../types";

/**
 * Obvyklé jednotlivé dávky pro dospělého, opsané z bodu 4.2 SPC.
 *
 * Proč tahle tabulka existuje: základní úlohy (objem z ampule, počet
 * ampulí, zbytek v ampuli, zpětný výpočet z dokumentace) dřív losovaly
 * dávku jako násobek obsahu ampule. Vycházely tak ordinace, které žádný
 * lékař nenapíše — 4,8 ampule ketaminu nebo 2 g zuklopenthixolu naráz.
 * Šablona teď smí zadat jen dávku z téhle tabulky.
 *
 * `singleMg` jsou dávky, které SPC u dospělého výslovně uvádí, nebo leží
 * uvnitř rozmezí z citace (např. 75 mg z rozmezí 50–100 mg). Nic mimo
 * citované rozmezí sem nepatří — hlídá to test.
 *
 * Přípravky dávkované jen podle hmotnosti nebo povrchu těla (cytostatika,
 * aminoglykosidy, myorelaxancia, amiodaron v infuzi) tu nejsou: pevná
 * dávka v mg by u nich byla vymyšlená. Vynechané jsou i přípravky, u
 * kterých by úloha „natáhněte z ampule“ zkreslovala postup:
 *  - Paracetamol Kabi 10 ml — ampule je podle SPC jen pro děti do 33 kg
 *  - Rivotril 1 mg/1 ml — před podáním se ředí dodaným rozpouštědlem
 *  - Solu-Medrol — lyofilizát s rozpouštědlem, objem ampule z DLP nevyčteme
 *
 * SPC z archivu SÚKL SPC20260827.zip, u centralizovaně registrovaných
 * přípravků z EMA. Ověřeno 24. 9. 2026.
 */
export type AdultDose = {
  /** Kód SÚKL přípravku ve fondu. */
  suklCode: string;
  product: string;
  /** Soubor SPC v archivu SÚKL, nebo dokument EMA. */
  spc: string;
  /** Jednotlivé dávky v mg, které se v úlohách smí objevit. */
  singleMg: readonly number[];
  /** Rozmezí, ze kterého dávky pocházejí — podle citace. */
  rangeMg: { min: number; max: number };
  /** Pasáž z bodu 4.2 SPC. Kde je složená z více míst, jsou nadpisy oddílů zkrácené. */
  quote: string;
  /** Kdy byl záznam ověřen, liší-li se od zbytku tabulky. */
  verifiedAt?: string;
  /** Kolikrát denně se dávka podle citace podává. U tablet, kvůli úloze na balení (A7). */
  timesPerDay?: readonly number[];
  /**
   * Bod 3 SPC: tabletu lze rozdělit na stejné dávky. Jen u takové tablety
   * smí úloha zadat půl tablety — půlicí rýha „pro snazší polykání“ nestačí.
   */
  divisibleQuote?: string;
  /**
   * Délka léčby podle citace (A7). U léčby, kterou SPC popisuje jako
   * dlouhodobou nebo udržovací, se počítá s předpisem na 28–90 dní.
   */
  course?: { min: number; max: number } | "longTerm";
  /** Rekonstituce lahvičky podle bodu 6.6 SPC (E1). */
  reconstitution?: { diluentMl: number; quote: string };
};

const VERIFIED_AT = "2026-09-24";
/** Tablety, další perorální roztoky a prášky k rekonstituci. */
const VERIFIED_AT_ORAL = "2026-10-05";

const LIST: readonly AdultDose[] = [
  // Antiemetika
  {
    suklCode: "0272969", product: "Zofran 2 mg/ml injekční roztok", spc: "SPC215233.pdf",
    singleMg: [4, 8], rangeMg: { min: 4, max: 8 },
    quote:
      "K léčbě pooperační nevolnosti a zvracení se doporučuje jednorázové podání dávky 4 mg. " +
      "Dávku 8 mg ondansetronu nebo nižší lze podat intramuskulárně nebo pomalou intravenózní infuzí.",
  },
  {
    suklCode: "0241762", product: "Kytril 1 mg/ml injekční/infuzní roztok", spc: "SPC229140.pdf",
    singleMg: [1, 2, 3], rangeMg: { min: 1, max: 3 },
    quote: "Před zahájením chemoterapie se dávka 1-3 mg (10-40 µg/kg) přípravku Kytril podává buď pomalou intravenózní injekcí, nebo naředěný v intravenózní infuzi.",
  },

  // Kardiovaskulární
  {
    suklCode: "0000362", product: "Adrenalin Léčiva 1 mg/ml injekční roztok", spc: "SPC217219.pdf",
    singleMg: [0.3, 0.5, 1], rangeMg: { min: 0.3, max: 1 },
    quote:
      "Srdeční zástava, dospělí: 1 mg intravenózně nebo intraoseálně. " +
      "Anafylaktický šok, dospělí: 0,3–0,5 mg (0,3–0,5 ml) do maximální jednotlivé dávky 1 mg.",
  },
  {
    suklCode: "0270436", product: "Ephedrine Kabi 10 mg/ml injekční roztok", spc: "SPC229000.pdf",
    singleMg: [5, 10], rangeMg: { min: 5, max: 10 },
    quote: "Pomalá 5mg intravenózní injekce (maximálně 10 mg), opakovaná podle potřeby každé 3–4 minuty až do maximální dávky 30 mg.",
  },
  {
    suklCode: "0246463", product: "Ephedrin BBP 50 mg/ml injekční roztok", spc: "SPC198435.pdf",
    singleMg: [12.5, 20, 25, 50], rangeMg: { min: 12.5, max: 50 },
    quote:
      "Při kolapsových stavech se podává 25-50 mg subkutánně nebo intramuskulárně. Při bronchospazmu se podá " +
      "počáteční dávka 12,5-25 mg. Při potřebě intravenózního podání se dávka 0,4 ml (20 mg) zředí. " +
      "Nejvyšší jednotlivá dávka je při podkožním a nitrosvalovém podání 50 mg.",
  },
  {
    suklCode: "0137238", product: "Adenocor 3 mg/ml injekční roztok", spc: "SPC204892.pdf",
    singleMg: [3, 6, 12], rangeMg: { min: 3, max: 12 },
    quote: "Počáteční dávka: 3 mg podané formou rychlého intravenózního bolusu. Druhá dávka: 6 mg. Třetí dávka: 12 mg.",
  },
  {
    suklCode: "0243408", product: "Furosemid BBP 10 mg/ml injekční roztok", spc: "SPC177542.pdf",
    singleMg: [20, 40], rangeMg: { min: 20, max: 40 },
    quote: "Dospělí a dospívající starší 15 let: 20 až 40 mg intravenózně (nebo ve výjimečných případech intramuskulárně).",
  },
  {
    suklCode: "0243407", product: "Furosemid BBP 125 mg/10 ml injekční roztok", spc: "SPC145416.pdf",
    singleMg: [20, 40], rangeMg: { min: 20, max: 40 },
    quote: "Dospělí a dospívající starší 15 let: 20 až 40 mg intravenózně (nebo ve výjimečných případech intramuskulárně).",
  },
  {
    suklCode: "0296748", product: "Grolan 5 mg/ml injekční roztok", spc: "SPC234983.pdf",
    singleMg: [10, 20], rangeMg: { min: 10, max: 20 },
    quote:
      "Léčba má být zahájena jednorázovou dávkou 2 ml přípravku Grolan denně (odpovídá 10 mg torasemidu). " +
      "Pokud je účinek nedostatečný, lze dávku zvýšit na 4 ml přípravku Grolan v jedné dávce (odpovídá 20 mg torasemidu).",
  },
  {
    suklCode: "0231703", product: "Betaloc 1 mg/ml injekční roztok", spc: "SPC235715.pdf",
    singleMg: [5, 10, 15], rangeMg: { min: 5, max: 15 },
    quote:
      "Úvodem se podá až 5 mg metoprololu i.v. Injekce může být opakována v pětiminutových intervalech. " +
      "Obvykle bývá dostatečná dávka 10-15 mg metoprololu.",
  },
  {
    suklCode: "0107938", product: "Cordarone 150 mg/3 ml injekční roztok", spc: "SPC204901.pdf",
    singleMg: [150, 300], rangeMg: { min: 150, max: 300 },
    quote:
      "Kardiopulmonální resuscitace: počáteční dávka je 300 mg amiodaronu zředěného ve 20 ml 5% dextrosy " +
      "podané jako i.v. bolus. Při přetrvávající komorové fibrilaci je možno zvážit podání dalších 150 mg i.v.",
  },

  // Kortikosteroidy
  {
    suklCode: "0232729", product: "Dexamethasone Krka 4 mg/ml injekční/infuzní roztok", spc: "SPC186947.pdf",
    singleMg: [4, 6, 8, 20], rangeMg: { min: 4, max: 20 },
    quote:
      "Profylaxe a léčba pooperačního zvracení: jednorázová dávka 4–8 mg intravenózně. " +
      "Léčba onemocnění COVID-19: dospělí pacienti 6 mg intravenózně. " +
      "Závažný akutní astmatický záchvat: dospělí co nejdříve 8-20 mg intravenózně.",
  },
  {
    suklCode: "0001673", product: "Dexamed 8 mg/2 ml injekční/infuzní roztok", spc: "SPC193413.pdf",
    singleMg: [4, 6, 8, 10, 20], rangeMg: { min: 2.5, max: 20 },
    quote:
      "Edém mozku: podává se 10 mg i.v., a dále 4 mg každých 6 hodin. Těžký akutní astmatický záchvat: " +
      "dospělí 8–20 mg i.v. Profylaxe pooperačního zvracení: jednorázová dávka 2,5–10 mg i.v. " +
      "COVID-19: dospělí 6 mg intravenózně jednou denně.",
  },
  {
    suklCode: "0008834", product: "Depo-Medrol 40 mg/ml injekční suspenze", spc: "SPC229525.pdf",
    singleMg: [20, 40, 80, 120], rangeMg: { min: 10, max: 120 },
    quote:
      "Středně velké klouby 10-40 mg. Při udržovací léčbě pacientů s revmatoidní artritidou se týdenní " +
      "intramuskulární dávka pohybuje mezi 40 a 120 mg. Při akutní těžké dermatitidě jedna dávka 80-120 mg.",
  },
  {
    suklCode: "0203637", product: "Trispan 20 mg/ml injekční suspenze", spc: "SPC194512.pdf",
    singleMg: [5, 10, 20], rangeMg: { min: 2, max: 20 },
    quote:
      "Dávka 2 až 20 mg je určována individuálně podle velikosti kloubu. Velké klouby obvykle vyžadují " +
      "dávku 10 až 20 mg (0,5 až 1 ml), středně velké 5 až 10 mg (0,25 až 0,5 ml).",
  },

  // Antibiotika
  {
    suklCode: "0064630", product: "Klimicin 150 mg/ml injekční roztok", spc: "SPC194409.pdf",
    singleMg: [300, 450, 600, 900], rangeMg: { min: 300, max: 900 },
    quote:
      "Doporučená denní dávka při středně těžkých infekcích je 1200 až 1800 mg denně, rozdělená do 3 nebo 4 " +
      "stejných dávek. Při těžkých infekcích 2400 až 2700 mg denně, rozdělená do 3 nebo 4 stejných dávek. " +
      "Individuální intramuskulární dávky nesmějí přesáhnout 600 mg.",
  },

  // Analgetika
  {
    suklCode: "0054539", product: "Dolmina 75 mg/3 ml injekční roztok", spc: "SPC229448.pdf",
    singleMg: [25, 50, 75], rangeMg: { min: 25, max: 75 },
    quote:
      "Zpravidla se aplikuje jedna ampulka denně (75 mg). K prevenci pooperačních bolestivých stavů se " +
      "doporučuje aplikovat nárazovou dávku 25 až 50 mg.",
  },
  {
    suklCode: "0057100", product: "Dexoket 50 mg/2 ml injekční/infuzní roztok", spc: "SPC228763.pdf",
    singleMg: [50], rangeMg: { min: 50, max: 50 },
    quote: "Doporučená dávka je 50 mg každých 8–12 hodin. Celková denní dávka nesmí překročit 150 mg.",
  },
  {
    suklCode: "0285129", product: "Morphine BBP 10 mg/ml injekční roztok", spc: "SPC223261.pdf",
    singleMg: [5, 10, 15, 20], rangeMg: { min: 5, max: 20 },
    quote:
      "Obvyklá jednotlivá terapeutická dávka morfinu je 10-20 mg intramuskulárně nebo subkutánně. " +
      "Nejvyšší jednotlivá dávka je 20 mg. Intravenózně se aplikuje velmi pomalu a dávka se snižuje o 1/3 až 1/2.",
  },
  {
    suklCode: "0002715", product: "Dolsin 50 mg/ml injekční roztok", spc: "SPC235543.pdf",
    singleMg: [25, 50, 75, 100], rangeMg: { min: 25, max: 100 },
    quote:
      "Intramuskulárně nebo subkutánně se při bolestech podává v dávce od 25 až 100 mg jednou až třikrát denně. " +
      "Intravenózně se velmi pomalu aplikuje ležícímu pacientovi 25-50 mg.",
  },
  {
    suklCode: "0241672", product: "Dipidolor 7,5 mg/ml injekční roztok", spc: "SPC232435.pdf",
    singleMg: [7.5, 15, 22.5, 30], rangeMg: { min: 7.5, max: 30 },
    quote:
      "Intramuskulární a subkutánní podání: dospělí jednotlivá dávka 15 – 30 mg. " +
      "Intravenózní podání: dospělí jednotlivá dávka 7,5 - 22,5 mg.",
  },
  {
    suklCode: "0118656", product: "Nalbuphin OrPha 10 mg/ml injekční roztok", spc: "SPC227267.pdf",
    singleMg: [10, 15, 20], rangeMg: { min: 10, max: 20 },
    quote:
      "Doporučená dávka u dospělých s tělesnou hmotností 70 kg činí 10–20 mg nalbufin-hydrochloridu. " +
      "Maximální jednotlivá dávka u dospělých nesmí překročit 20 mg.",
  },
  {
    suklCode: "0201134", product: "Tramal 50 mg/ml injekční roztok", spc: "SPC225540.pdf",
    singleMg: [50, 75, 100], rangeMg: { min: 50, max: 100 },
    quote: "Dospělí a dospívající od 12 let: 50 – 100 mg tramadol-hydrochloridu po 4 – 6 hodinách.",
  },
  {
    suklCode: "0067558", product: "Mabron 100 mg/2 ml injekční roztok", spc: "SPC210785.pdf",
    singleMg: [50, 75, 100], rangeMg: { min: 50, max: 100 },
    quote: "Dospělí a dospívající od 12 let: 50–100 mg tramadol-hydrochloridu ve 4–6hodinových intervalech.",
  },
  {
    suklCode: "0269736", product: "Afexil 500 mg/ml injekční roztok", spc: "SPC221760.pdf",
    singleMg: [500, 750, 1000], rangeMg: { min: 500, max: 1000 },
    quote: "Dospělí a dospívající od 15 let (> 53 kg): jednotlivá dávka 1,0-2,0 ml, 500-1 000 mg.",
  },

  // Antiepileptika
  {
    suklCode: "0084449", product: "Luminal 200 mg/ml injekční roztok", spc: "SPC204093.pdf",
    singleMg: [200, 400], rangeMg: { min: 200, max: 400 },
    quote:
      "Dospělým se podává obvykle 200 mg fenobarbitalu (1 ml injekčního roztoku přípravku Luminal) i.m., " +
      "nebo pomalu i.v. Maximální jednotlivá dávka činí u dospělých 400 mg fenobarbitalu.",
  },
  {
    suklCode: "0193299", product: "Vimpat 10 mg/ml infuzní roztok", spc: "EMA: vimpat-epar-product-information_cs.pdf",
    singleMg: [50, 100, 150, 200], rangeMg: { min: 50, max: 200 },
    quote:
      "Doporučená počáteční dávka je 50 mg dvakrát denně, která má být po jednom týdnu zvýšena až na " +
      "počáteční terapeutickou dávku 100 mg dvakrát denně. Přídatná léčba: až 200 mg dvakrát denně.",
  },

  // Psychiatrie a sedace
  {
    suklCode: "0185369", product: "Afluditen 25 mg/ml injekční roztok", spc: "SPC131355.pdf",
    singleMg: [12.5, 25, 50], rangeMg: { min: 12.5, max: 100 },
    quote:
      "U většiny nemocných se doporučuje začínat dávkou 12,5 až 25 mg (0,5 až 1,0 ml). Dávka by neměla " +
      "překročit 100 mg. Ukáže-li se, že pacient potřebuje dávku vyšší než 50 mg, následující dávky by se " +
      "měly opatrně postupně zvyšovat.",
  },
  {
    suklCode: "0002538", product: "Haloperidol-Richter 5 mg/ml injekční roztok", spc: "SPC118431.pdf",
    singleMg: [1, 2, 5], rangeMg: { min: 1, max: 10 },
    quote:
      "Rychlé zvládnutí těžké akutní psychomotorické agitovanosti: 5 mg intramuskulárně. Akutní léčba " +
      "deliria: 1 až 10 mg intramuskulárně. Profylaxe pooperační nauzey a zvracení: 1 až 2 mg intramuskulárně.",
  },
  {
    suklCode: "0031298", product: "Fluanxol Depot 20 mg/ml injekční roztok", spc: "SPC224986.pdf",
    singleMg: [20, 40], rangeMg: { min: 20, max: 40 },
    quote: "Během udržovací léčby se dávka obvykle pohybuje v rozmezí 20−40 mg (1−2 ml) každé 2−4 týdny.",
  },
  {
    suklCode: "0093252", product: "Cisordinol-Acutard 50 mg/ml injekční roztok", spc: "SPC233180.pdf",
    singleMg: [50, 100, 150], rangeMg: { min: 50, max: 150 },
    quote: "Dávka se obvykle nachází v rozmezí 50-150 mg (1-3 ml) a podává se ve formě intramuskulární injekce.",
  },
  {
    suklCode: "0086900", product: "Cisordinol Depot 200 mg/ml injekční roztok", spc: "SPC233178.pdf",
    singleMg: [200, 400], rangeMg: { min: 200, max: 400 },
    quote: "Během udržovací léčby se obvyklá dávka pohybuje v rozmezí 200-400 mg (1-2 ml) každé 2-4 týdny.",
  },
  {
    suklCode: "0269060", product: "Tiapridal 100 mg/2 ml injekční roztok", spc: "SPC203387.pdf",
    singleMg: [50, 100], rangeMg: { min: 50, max: 100 },
    quote:
      "Krátkodobá léčba agitovaných a agresivních stavů u pacientů závislých na alkoholu: dospělí 200 – 300 mg " +
      "za den. Podávejte injekce v intervalu 6 hodin. Nepřekračujte dávku 100 mg/injekci.",
  },
  {
    suklCode: "0027898", product: "Abilify 7,5 mg/ml injekční roztok", spc: "EMA: abilify-epar-product-information_cs.pdf",
    singleMg: [5.25, 9.75], rangeMg: { min: 5.25, max: 15 },
    quote:
      "Doporučená počáteční dávka injekčního roztoku ABILIFY je 9,75 mg (1,3 ml). Účinné dávkovací rozpětí " +
      "v jedné injekci je 5,25 mg až 15 mg. Nižší dávku 5,25 mg (0,7 ml) lze aplikovat na základě posouzení.",
  },
  {
    suklCode: "0096610", product: "Apaurin 10 mg/2 ml injekční roztok", spc: "SPC132962.pdf",
    singleMg: [5, 10, 20], rangeMg: { min: 5, max: 20 },
    quote:
      "Akutní stavy úzkosti a rozrušení: dospělí 5 až 10 mg intravenózně nebo intramuskulárně. " +
      "Delirium tremens: dospělí 10 až 20 mg intravenózně nebo intramuskulárně.",
  },
  {
    suklCode: "0243827", product: "Temelor 4 mg/ml injekční roztok", spc: "SPC234548.pdf",
    singleMg: [2, 4], rangeMg: { min: 2, max: 4 },
    quote:
      "Symptomatická léčba patologické úzkosti: doporučená počáteční dávka je 2–4 mg intravenózně. " +
      "Status epilepticus: dospělí 4 mg intravenózně.",
  },
  {
    suklCode: "0239963", product: "Midazolam Accord 1 mg/ml injekční/infuzní roztok", spc: "SPC216091.pdf",
    singleMg: [1, 2, 2.5], rangeMg: { min: 1, max: 2.5 },
    quote:
      "U dospělých pod 60 let věku je počáteční dávka 2 až 2,5 mg podávána 5 až 10 minut před začátkem " +
      "zákroku. Další dávky po 1 mg mohou být podány podle potřeby.",
  },
  {
    suklCode: "0247447", product: "Dormicum 5 mg/ml injekční roztok", spc: "SPC202206.pdf",
    singleMg: [1, 2, 2.5], rangeMg: { min: 1, max: 2.5 },
    quote:
      "U dospělých pacientů do 60 let věku je doporučovaná počáteční dávka 2 - 2,5 mg, podaných 5 - 10 minut " +
      "před začátkem výkonu. Pokud je třeba, mohou být dále podány další dávky po 1 mg.",
  },

  // Lokální anestetika
  {
    suklCode: "0030767", product: "Lidocaine Egis 20 mg/ml injekční roztok", spc: "SPC207213.pdf",
    singleMg: [40, 60, 100, 200], rangeMg: { min: 40, max: 200 },
    quote:
      "Lokální anestezie: doporučená dávka pro navození blokády nervů je 5-10 ml přípravku Lidocaine Egis; " +
      "k anestezii prstů na ruce a noze se podávají 2-3 ml. Kardiologie: bolus maximálně 100 mg.",
  },

  // Perorální roztoky a kapky
  {
    suklCode: "0201131", product: "Tramal 100 mg/ml perorální roztok", spc: "SPC225539.pdf",
    singleMg: [50, 75, 100], rangeMg: { min: 50, max: 100 },
    quote:
      "Dospělí a dospívající od 12 let s tělesnou hmotností více než 50 kg: 50 - 100 mg " +
      "tramadol-hydrochloridu po 4 – 6 hodinách.",
  },
  {
    suklCode: "0196015", product: "Metamizol Stada 500 mg/ml perorální kapky", spc: "SPC223865.pdf",
    singleMg: [500, 750, 1000], rangeMg: { min: 500, max: 1000 },
    quote: "Dospělí a dospívající od 15 let (> 53 kg) mohou jednorázově užít až 1 000 mg. Jednotlivá dávka 20-40 kapek, 500-1000 mg.",
  },
  {
    suklCode: "0002539", product: "Haloperidol-Richter 2 mg/ml perorální kapky", spc: "SPC147111.pdf",
    singleMg: [1, 2, 5], rangeMg: { min: 1, max: 10 },
    quote:
      "Léčba schizofrenie: 2 až 10 mg/den perorálně, jako jedná dávka nebo ve 2 dílčích dávkách. " +
      "Akutní léčba deliria: 1 až 10 mg/den perorálně, jako jedná dávka nebo ve 2 až 3 dílčích dávkách.",
  },
  {
    suklCode: "0260318", product: "Rivotril 2,5 mg/ml perorální kapky", spc: "SPC193170.pdf",
    singleMg: [0.5, 1, 2], rangeMg: { min: 0.5, max: 2 },
    quote:
      "Počáteční dávka pro dospělé nemá překročit 1,5 mg/den podaných rozděleně ve dvou až třech dávkách. " +
      "Obvykle je dostačující udržovací dávka 3 – 6 mg/den. Denní dávka má být rozdělena do tří stejných dávek.",
  },
  {
    suklCode: "0246584", product: "Morfin sulfát Ardez 20 mg/ml perorální kapky", spc: "SPC209639.pdf",
    singleMg: [10, 20], rangeMg: { min: 10, max: 20 },
    quote:
      "Dospělí a dospívající 16 let a starší: počáteční dávka morfin-sulfátu obvykle 10-20 mg " +
      "(odpovídající 0,5-1,0 ml) každých 4-6 hodin.",
  },

  // Tablety a tobolky (A1, A5, A7). Dávky jsou jednotlivé, četnost podle
  // téže citace. Ověřeno 5. 10. 2026 z archivu SPC20260827.zip.
  {
    suklCode: "0208202", product: "Siofor 500 mg potahované tablety", spc: "SPC221739.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [500, 1000], rangeMg: { min: 500, max: 1000 }, timesPerDay: [2, 3], course: "longTerm",
    quote:
      "Obvyklá zahajovací dávka je 1 potahovaná tableta 2krát nebo 3krát denně během jídla nebo po jídle. … " +
      "Maximální doporučená dávka metformin hydrochloridu je 3 g denně, užívá se ve třech jednotlivých dávkách.",
  },
  {
    suklCode: "0188455", product: "Glyclada 60 mg tablety s řízeným uvolňováním", spc: "SPC219455.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [30, 60, 90, 120], rangeMg: { min: 30, max: 120 }, timesPerDay: [1], course: "longTerm",
    divisibleQuote: "Tabletu lze rozdělit na stejné dávky.",
    quote:
      "Denní dávka přípravku Glyclada 60 mg tablety s řízeným uvolňováním, je v rozmezí od ½ tablety do 2 tablet, " +
      "tj. od 30 do 120 mg užívaných perorálně najednou v době snídaně. … Pokud je glykemie efektivně upravena, " +
      "může se tato dávka použít k udržovací léčbě.",
  },
  {
    suklCode: "0241843", product: "Glyclada 30 mg tablety s řízeným uvolňováním", spc: "SPC219458.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [30, 60, 90, 120], rangeMg: { min: 30, max: 120 }, timesPerDay: [1], course: "longTerm",
    quote:
      "Denní dávka je v rozmezí od 1 do 4 tablet denně, tj. od 30 do 120 mg užívaných perorálně najednou v době " +
      "snídaně. … Pokud je glykémie efektivně kontrolována, může se tato dávka použít k udržovací léčbě.",
  },
  {
    suklCode: "0098218", product: "FURON 40 mg tablety", spc: "SPC220378.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [20, 40, 80], rangeMg: { min: 20, max: 80 }, timesPerDay: [1],
    divisibleQuote: "Tabletu lze rozdělit na stejné dávky.",
    quote: "Při léčbě edémových stavů dospělých pacientů je obvyklá úvodní dávka 20-80 mg denně v jedné dávce.",
  },
  {
    suklCode: "0003550", product: "Verospiron 25 mg tablety", spc: "SPC229285.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [25, 50, 100], rangeMg: { min: 25, max: 100 }, timesPerDay: [1, 2], course: "longTerm",
    quote:
      "Počáteční denní dávka je 100 mg, která se může pohybovat v rozmezí 25 až 200 mg denně, podávaná buď " +
      "jednorázově, nebo rozdělená do dvou dávek. … spironolakton se má podávat ve formě dlouhodobé udržovací léčby.",
  },
  {
    suklCode: "0046755", product: "Verospiron 50 mg tablety", spc: "SPC229287.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [50, 100], rangeMg: { min: 25, max: 100 }, timesPerDay: [1, 2], course: "longTerm",
    quote:
      "Počáteční denní dávka je 100 mg, která se může pohybovat v rozmezí 25 až 200 mg denně, podávaná buď " +
      "jednorázově, nebo rozdělená do dvou dávek. … spironolakton se má podávat ve formě dlouhodobé udržovací léčby.",
  },
  {
    suklCode: "0054150", product: "Egilok 25 mg tablety", spc: "SPC232437.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [25, 50, 100], rangeMg: { min: 25, max: 100 }, timesPerDay: [2], course: "longTerm",
    quote:
      "U mírné až středně těžké hypertenze je zahajovací dávka 25 až 50 mg dvakrát denně (ráno a večer). " +
      "U nereagujících pacientů se denní dávka může postupně zvyšovat až na 100 mg dvakrát denně. … " +
      "Udržovací léčba po prodělaném infarktu myokardu: Doporučená dávka je 50 až 100 mg dvakrát denně.",
  },
  {
    suklCode: "0247007", product: "Concor COR 1,25 mg potahované tablety", spc: "SPC235191.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [1.25, 2.5, 3.75, 5, 7.5, 10], rangeMg: { min: 1.25, max: 10 }, timesPerDay: [1], course: "longTerm",
    quote:
      "1,25 mg denně po dobu 1 týdne; … 2,5 mg denně další týden; … 3,75 mg denně další týden; … 5 mg denně " +
      "další 4 týdny; … 7,5 mg denně další 4 týdny; … 10 mg denně jako udržovací dávka. " +
      "Maximální doporučená dávka je 10 mg denně.",
  },
  {
    suklCode: "0195983", product: "Sobycor 2,5 mg potahované tablety", spc: "SPC180856.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [5, 10], rangeMg: { min: 5, max: 10 }, timesPerDay: [1],
    divisibleQuote: "Tabletu lze rozdělit na stejné dávky.",
    quote:
      "Obvyklá dávka je 10 mg jednou denně s maximální doporučovanou dávkou 20 mg denně. " +
      "Pro některé pacienty může být vhodná dávka 5 mg denně.",
  },
  {
    suklCode: "0002944", product: "AGEN 5 mg tablety", spc: "SPC191284.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [5, 10], rangeMg: { min: 5, max: 10 }, timesPerDay: [1],
    divisibleQuote: "Tabletu lze rozdělit na stejné dávky.",
    quote:
      "U léčby hypertenze i anginy pectoris je obvyklá počáteční dávka 5 mg přípravku AGEN jedenkrát denně, " +
      "kterou je možno zvýšit až na maximální dávku 10 mg v závislosti na individuální reakci pacienta.",
  },
  {
    suklCode: "0188842", product: "Stacyl 100 mg enterosolventní tablety", spc: "SPC211350.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [100], rangeMg: { min: 100, max: 100 }, timesPerDay: [1], course: "longTerm",
    quote: "Obvyklá dávka při dlouhodobém podávání je 100 mg jednou denně.",
  },
  {
    suklCode: "0274029", product: "Sewab 5 mg potahované tablety", spc: "SPC232228.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [5, 10], rangeMg: { min: 5, max: 10 }, timesPerDay: [2],
    quote:
      "Doporučená dávka apixabanu je 5 mg perorálně 2x denně. … Doporučená dávka apixabanu k léčbě akutní DVT " +
      "a léčbě PE je 10 mg užívaných perorálně 2x denně po dobu prvních 7 dní; poté se užívá 5 mg perorálně 2x denně.",
  },
  {
    suklCode: "0243142", product: "Fortecortin 4 mg tablety", spc: "SPC235240.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [6], rangeMg: { min: 6, max: 6 }, timesPerDay: [1], course: { min: 5, max: 10 },
    divisibleQuote: "Tabletu lze rozdělit na stejné dávky.",
    quote: "K léčbě onemocnění Covid-19: Dospělí pacienti 6 mg jednou denně, až po dobu 10 dnů.",
  },
  {
    suklCode: "0094453", product: "Ciprinol 250 mg potahované tablety", spc: "SPC234938.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [250, 500, 750], rangeMg: { min: 250, max: 750 }, timesPerDay: [2], course: { min: 7, max: 14 },
    quote:
      "Infekce dolních dýchacích cest: 2× denně 500 mg až 2× denně 750 mg, 7 až 14 dnů. … " +
      "Nekomplikovaná akutní cystitida: 2× denně 250 mg až 2× denně 500 mg.",
  },
  {
    suklCode: "0096039", product: "Ciprinol 500 mg potahované tablety", spc: "SPC234940.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [500], rangeMg: { min: 250, max: 750 }, timesPerDay: [2], course: { min: 7, max: 14 },
    quote:
      "Infekce dolních dýchacích cest: 2× denně 500 mg až 2× denně 750 mg, 7 až 14 dnů. … " +
      "Komplikovaná cystitida, akutní pyelonefritida: 2× denně 500 mg, 7 dnů.",
  },
  {
    suklCode: "0267346", product: "Klacid 250 mg potahované tablety", spc: "SPC221566.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [250, 500], rangeMg: { min: 250, max: 500 }, timesPerDay: [2], course: { min: 5, max: 14 },
    quote:
      "Obvyklá doporučená dávka klarithromycinu u dospělých a dospívajících od 12 let je 250 mg dvakrát denně. " +
      "Při těžších infekcích lze dávku zvýšit na 500 mg dvakrát denně. Obvyklá délka léčby je 5 až 14 dní.",
  },
  {
    suklCode: "0249046", product: "Klabax 500 mg potahované tablety", spc: "SPC209100.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [250, 500], rangeMg: { min: 250, max: 500 }, timesPerDay: [2], course: { min: 5, max: 14 },
    divisibleQuote: "Tabletu lze rozdělit na stejné dávky.",
    quote:
      "Obvyklá doporučená dávka klarithromycinu u dospělých a dospívajících od 12 let věku je 250 mg dvakrát " +
      "denně. Při těžších infekcích lze dávku zvýšit na 500 mg dvakrát denně. Obvyklá délka léčby je 5 až 14 dní.",
  },
  {
    suklCode: "0091193", product: "Dalacin C 150 mg tvrdé tobolky", spc: "SPC236502.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [300, 450], rangeMg: { min: 150, max: 900 }, timesPerDay: [2, 3, 4],
    quote: "Obvyklá dávka je 600 až 1800 mg/den rozdělená do 2, 3 nebo 4 stejných dávek.",
  },
  {
    suklCode: "0083459", product: "Dalacin C 300 mg tvrdé tobolky", spc: "SPC236504.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [300, 600], rangeMg: { min: 150, max: 900 }, timesPerDay: [2, 3],
    quote: "Obvyklá dávka je 600 až 1800 mg/den rozdělená do 2, 3 nebo 4 stejných dávek.",
  },
  {
    suklCode: "0021717", product: "Veral 50 mg enterosolventní tablety", spc: "SPC226959.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [50], rangeMg: { min: 37.5, max: 75 }, timesPerDay: [2, 3],
    quote:
      "Artrózy a akutní bolestivé stavy: Doporučená denní dávka je 75 - 100 mg denně, rozdělená do 2 dílčích " +
      "dávek. … Zánětlivá revmatická onemocnění: Doporučená denní dávka je 100-150 mg diklofenaku rozdělená " +
      "do 2 – 3 dílčích dávek.",
  },
  {
    suklCode: "0015479", product: "Ibumax 200 mg potahované tablety", spc: "SPC215913.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [200, 400], rangeMg: { min: 200, max: 400 }, timesPerDay: [3, 4],
    quote: "Jako analgetikum-antipyretikum se podává 3 - 4krát denně v dávkách 200 - 400 mg perorálně.",
  },
  {
    suklCode: "0067568", product: "Mabron 50 mg tvrdé tobolky", spc: "SPC210783.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [50, 100], rangeMg: { min: 50, max: 100 }, timesPerDay: [2, 3, 4],
    quote:
      "Denní dávka léčivé látky nemá, kromě zvláštních klinických případů, překročit 400 mg. … " +
      "Dospělí a dospívající od 12 let: 50 nebo 100 mg tramadol-hydrochloridu ve 4–6hodinových intervalech.",
  },
  {
    suklCode: "0248671", product: "Diazepam Stada 5 mg tablety", spc: "SPC186790.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [2.5, 5], rangeMg: { min: 2, max: 5 }, timesPerDay: [2, 3], course: { min: 7, max: 28 },
    divisibleQuote: "Dávka 2,5 mg se docílí podáním půlky 5mg tablety.",
    quote:
      "Úzkost: Obvyklá dávka: 2 mg až 5 mg diazepamu dvakrát až třikrát denně. … " +
      "Léčba plnou dávkou nemá překročit 4 týdny.",
  },
  {
    suklCode: "0248679", product: "Diazepam Stada 10 mg tablety", spc: "SPC186904.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [10], rangeMg: { min: 10, max: 10 }, timesPerDay: [2, 3], course: { min: 7, max: 28 },
    quote:
      "Maximální dávka: V závažných případech může být dávka postupně zvýšena až na 30 mg diazepamu denně " +
      "podávaných ve 2 až 4 dílčích dávkách. … Léčba plnou dávkou nemá překročit 4 týdny.",
  },
  {
    suklCode: "0083318", product: "Digoxin 0,125 Léčiva tablety", spc: "SPC236508.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [0.125, 0.25], rangeMg: { min: 0.125, max: 0.25 }, timesPerDay: [1], course: "longTerm",
    quote: "Udržovací dávka: Obvyklá udržovací denní dávka je 0,125-0,250 mg p.o. 1x denně.",
  },
  {
    suklCode: "0003542", product: "Digoxin 0,250 Léčiva tablety", spc: "SPC236510.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [0.125, 0.25], rangeMg: { min: 0.125, max: 0.25 }, timesPerDay: [1], course: "longTerm",
    divisibleQuote: "Tabletu lze rozdělit na stejné dávky.",
    quote: "Udržovací dávka: Obvyklá udržovací denní dávka je 0,125-0,250 mg p.o. 1x denně.",
  },
  {
    suklCode: "0290269", product: "Xanax 0,25 mg tablety", spc: "SPC231648.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [0.25, 0.5], rangeMg: { min: 0.25, max: 0.5 }, timesPerDay: [3], course: { min: 14, max: 28 },
    quote:
      "Přípravek Xanax se užívá v nejnižší možné účinné dávce po nejkratší možnou dobu léčby, maximálně 2-4 " +
      "týdny. … Doporučená zahajovací dávka: v rozmezí 0,25-0,5 mg 3x denně.",
  },
  {
    suklCode: "0290271", product: "Xanax 0,5 mg tablety", spc: "SPC231645.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [0.5], rangeMg: { min: 0.25, max: 0.5 }, timesPerDay: [3], course: { min: 14, max: 28 },
    quote:
      "Přípravek Xanax se užívá v nejnižší možné účinné dávce po nejkratší možnou dobu léčby, maximálně 2-4 " +
      "týdny. … Doporučená zahajovací dávka: v rozmezí 0,25-0,5 mg 3x denně.",
  },
  {
    suklCode: "0174689", product: "Trund 500 mg potahované tablety", spc: "SPC233307.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [500, 1000, 1500], rangeMg: { min: 250, max: 1500 }, timesPerDay: [2],
    quote:
      "Počáteční terapeutická dávka je 500 mg dvakrát denně. … Podle klinické odpovědi a snášenlivosti lze " +
      "denní dávku zvýšit až na 1 500 mg dvakrát denně.",
  },
  {
    suklCode: "0174677", product: "Trund 250 mg potahované tablety", spc: "SPC233305.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [250, 500], rangeMg: { min: 250, max: 1500 }, timesPerDay: [2],
    quote:
      "může být podána nižší počáteční dávka 250 mg dvakrát denně. Po dvou týdnech ji lze zvýšit na 500 mg " +
      "dvakrát denně.",
  },
  {
    suklCode: "0130811", product: "Gordius 300 mg tvrdé tobolky", spc: "SPC235626.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [300, 600], rangeMg: { min: 300, max: 1200 }, timesPerDay: [3], course: "longTerm",
    quote:
      "Epilepsie většinou vyžaduje dlouhodobou léčbu. … V klinických studiích se účinná dávka pohybovala " +
      "v rozmezí od 900 do 3600 mg/den. Léčbu lze zahájit … podáním dávky 300 mg třikrát denně 1. den.",
  },
  {
    suklCode: "0263610", product: "Risperidone Grindeks 0,5 mg potahované tablety", spc: "SPC210666.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [0.5], rangeMg: { min: 0.5, max: 0.5 }, timesPerDay: [2],
    quote: "Léčba se zahajuje doporučenou dávkou 0,5 mg dvakrát denně.",
  },
  {
    suklCode: "0010527", product: "Rispen 1 mg potahované tablety", spc: "SPC177097.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [0.5], rangeMg: { min: 0.5, max: 0.5 }, timesPerDay: [2],
    divisibleQuote: "Tabletu lze rozdělit na stejné dávky.",
    quote: "Léčba se zahajuje doporučenou dávkou 0,5 mg dvakrát denně.",
  },
  {
    suklCode: "0260313", product: "Rivotril 0,5 mg tablety", spc: "SPC193221.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [0.5, 1, 1.5, 2], rangeMg: { min: 0.5, max: 2 }, timesPerDay: [3],
    divisibleQuote: "Tabletu lze rozdělit na stejné dávky.",
    quote:
      "Počáteční dávka pro dospělé nemá překročit 1,5 mg/den podaných rozděleně ve dvou až třech dávkách. … " +
      "dostačující udržovací dávka 3 – 6 mg/den. … Pokud je to možné, má být denní dávka rozdělena do tří " +
      "stejných dávek.",
  },
  {
    suklCode: "0259293", product: "Temelor 0,5 mg tablety", spc: "SPC214019.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [0.5], rangeMg: { min: 0.5, max: 0.5 }, timesPerDay: [2, 3],
    quote: "Úzkost: Počáteční dávka 0,5 mg, 2–3krát denně, udržovací dávka je až 2,5 mg denně.",
  },
  {
    suklCode: "0259249", product: "Temelor 1 mg tablety", spc: "SPC214016.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [0.5], rangeMg: { min: 0.5, max: 0.5 }, timesPerDay: [2, 3],
    divisibleQuote: "Tabletu lze rozdělit na stejné dávky.",
    quote: "Úzkost: Počáteční dávka 0,5 mg, 2–3krát denně, udržovací dávka je až 2,5 mg denně.",
  },
  {
    suklCode: "0024155", product: "Oltar 2 mg tablety", spc: "SPC210805.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [1], rangeMg: { min: 1, max: 1 }, timesPerDay: [1],
    divisibleQuote: "Tabletu lze rozdělit na stejné dávky.",
    quote: "Doporučená počáteční dávka glimepiridu je 1 mg denně.",
  },
  {
    suklCode: "0002537", product: "Haloperidol-Richter 1,5 mg tablety", spc: "SPC147113.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [1.5, 3, 4.5], rangeMg: { min: 1, max: 5 }, timesPerDay: [2],
    quote: "Léčba schizofrenie: 2 až 10 mg/den perorálně, jako jedná dávka nebo ve 2 dílčích dávkách.",
  },
  {
    suklCode: "0263124", product: "Becalen 1,5 mg tablety", spc: "SPC210275.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [1.5, 3], rangeMg: { min: 1.5, max: 3 }, timesPerDay: [1, 2, 3],
    quote: "Ambulantní léčba: Dávka pro dospělé je 1,5–3 mg až 3× denně.",
  },
  {
    suklCode: "0263125", product: "Becalen 3 mg tablety", spc: "SPC210278.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [3], rangeMg: { min: 1.5, max: 3 }, timesPerDay: [1, 2, 3],
    quote: "Ambulantní léčba: Dávka pro dospělé je 1,5–3 mg až 3× denně.",
  },

  // Další perorální roztoky (A2).
  {
    suklCode: "0054177", product: "Risperdal 1 mg/ml perorální roztok", spc: "SPC231512.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [0.5, 1, 2], rangeMg: { min: 0.5, max: 2 },
    quote:
      "RISPERDAL je možno užívat jednou nebo dvakrát denně. Léčba se zahajuje dávkou 2 mg risperidonu denně. … " +
      "Starší pacienti: Léčba se zahajuje doporučenou dávkou 0,5 mg dvakrát denně.",
  },
  {
    suklCode: "0182380", product: "Palexia 20 mg/ml perorální roztok", spc: "SPC229816.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [50], rangeMg: { min: 50, max: 50 },
    quote: "Doporučená zahajovací dávka je 50 mg tapentadolu ve formě perorálního roztoku po 4 až 6 hodinách.",
  },

  // Prášky k rekonstituci (E1, E5). Rozpouštědlo jen tam, kde bod 6.6
  // uvádí objem i výslednou koncentraci bez objemu prášku navíc.
  {
    suklCode: "0121237", product: "Ceftriaxon Kabi 1 g prášek pro injekční/infuzní roztok", spc: "SPC212156.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [500, 1000, 2000, 4000], rangeMg: { min: 500, max: 4000 },
    reconstitution: { diluentMl: 10, quote: "Voda pro injekci 1 g 10 ml 100 mg/ml" },
    quote:
      "1–2 g jednou denně: komunitní pneumonie … 2–4 g jednou denně: bakteriální endokarditida, bakteriální " +
      "meningitida … Gonorea: 500 mg v jedné intramuskulární dávce.",
  },
  {
    suklCode: "0121239", product: "Ceftriaxon Kabi 2 g prášek pro infuzní roztok", spc: "SPC212159.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [500, 1000, 2000, 4000], rangeMg: { min: 500, max: 4000 },
    reconstitution: { diluentMl: 40, quote: "0,9% roztok NaCl 2 g 40 ml 50 mg/ml" },
    quote:
      "1–2 g jednou denně: komunitní pneumonie … 2–4 g jednou denně: bakteriální endokarditida, bakteriální " +
      "meningitida … Gonorea: 500 mg v jedné intramuskulární dávce.",
  },

  {
    suklCode: "0064834", product: "AXETINE 750 mg prášek pro injekční/infuzní roztok", spc: "SPC228377.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [750, 1500], rangeMg: { min: 750, max: 1500 },
    quote: "Komunitní pneumonie … 750 mg každých 8 hodin. … Komplikované infekce močových cest … 1,5 g každých 8 hodin.",
  },
  {
    suklCode: "0246093", product: "AMPICILIN BBP 0,5 g prášek pro injekční/infuzní roztok", spc: "SPC154508.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [1000, 1500], rangeMg: { min: 500, max: 1500 },
    quote: "Obvyklá dávka: Dospělí 2 - 6 g/den, v dílčích dávkách po 6 hodinách po dobu 7 -10 dnů.",
  },
  {
    suklCode: "0246096", product: "AMPICILIN BBP 1 g prášek pro injekční/infuzní roztok", spc: "SPC154505.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [500, 1500], rangeMg: { min: 500, max: 1500 },
    reconstitution: {
      diluentMl: 20,
      quote: "Injekční roztok k pomalé intravenózní injekci se připraví rekonstitucí … 1,0 g v 20 až 60 ml izotonického roztoku chloridu sodného.",
    },
    quote: "Obvyklá dávka: Dospělí 2 - 6 g/den, v dílčích dávkách po 6 hodinách po dobu 7 -10 dnů.",
  },
  {
    suklCode: "0206563", product: "TAXIMED 1 g prášek pro injekční/infuzní roztok", spc: "SPC225032.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [2000], rangeMg: { min: 1000, max: 2000 },
    quote: "Obvykle se podává 1 až 2 g cefotaximu každých 12 hodin.",
  },
  {
    suklCode: "0273263", product: "Fortum 500 mg prášek pro injekční/infuzní roztok", spc: "SPC221078.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [1000, 2000], rangeMg: { min: 1000, max: 2000 },
    quote: "Infekce kostí a kloubů: 1-2 g každých 8 hodin.",
  },
  {
    suklCode: "0273266", product: "Fortum 1 g prášek pro injekční/infuzní roztok", spc: "SPC221075.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [2000], rangeMg: { min: 1000, max: 2000 },
    quote: "Infekce kostí a kloubů: 1-2 g každých 8 hodin.",
  },
  {
    suklCode: "0183811", product: "ARCHIFAR 500 mg prášek pro injekční/infuzní roztok", spc: "SPC225574.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [1000, 2000], rangeMg: { min: 500, max: 2000 },
    quote: "Dávka podaná každých 8 hodin: 500 mg nebo 1 g … Bronchopulmonální infekce u cystické fibrózy 2 g.",
  },
  {
    suklCode: "0225456", product: "Meronem 1 g prášek pro injekční/infuzní roztok", spc: "SPC225238.pdf", verifiedAt: VERIFIED_AT_ORAL,
    singleMg: [2000], rangeMg: { min: 500, max: 2000 },
    quote: "Dávka podaná každých 8 hodin: 500 mg nebo 1 g … Bronchopulmonální infekce u cystické fibrózy 2 g.",
  },
];

export const ADULT_DOSES: ReadonlyMap<string, AdultDose> = new Map(LIST.map((d) => [d.suklCode, d]));

export function adultDoseFor(suklCode: string): AdultDose | undefined {
  return ADULT_DOSES.get(suklCode);
}

export function adultDoseSource(dose: AdultDose): Source {
  const where = dose.spc.startsWith("EMA:")
    ? "https://www.ema.europa.eu/cs/documents/product-information/" + dose.spc.slice(5).trim()
    : "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics";
  const parts = [`bod 4.2: „${dose.quote}“`];
  if (dose.divisibleQuote) parts.push(`bod 3: „${dose.divisibleQuote}“`);
  if (dose.reconstitution) parts.push(`bod 6.6: „${dose.reconstitution.quote}“`);
  return {
    citation: `SPC přípravku ${dose.product}, ${parts.join("; ")}`,
    url: where,
    suklCode: dose.suklCode,
    verifiedAt: dose.verifiedAt ?? VERIFIED_AT,
  };
}
