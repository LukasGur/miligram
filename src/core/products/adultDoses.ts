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
};

const VERIFIED_AT = "2026-09-24";

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
];

export const ADULT_DOSES: ReadonlyMap<string, AdultDose> = new Map(LIST.map((d) => [d.suklCode, d]));

export function adultDoseFor(suklCode: string): AdultDose | undefined {
  return ADULT_DOSES.get(suklCode);
}

export function adultDoseSource(dose: AdultDose): Source {
  const where = dose.spc.startsWith("EMA:")
    ? "https://www.ema.europa.eu/cs/documents/product-information/" + dose.spc.slice(5).trim()
    : "https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics";
  return {
    citation: `SPC přípravku ${dose.product}, bod 4.2: „${dose.quote}“`,
    url: where,
    suklCode: dose.suklCode,
    verifiedAt: VERIFIED_AT,
  };
}
