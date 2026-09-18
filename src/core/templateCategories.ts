import type { Category } from "./types";

/**
 * Která šablona patří do které kategorie.
 *
 * Tabulka je schválně opsaná vedle šablon samotných. `categoryOf()`
 * v lesson.ts sahá přes registr na všech 72 šablon, a s nimi na fond
 * 614 přípravků — tedy 300 kB, které domovská obrazovka nesmí stáhnout
 * jen proto, aby spočítala, jak student stojí v učivu.
 *
 * Písmeno v identifikátoru nestačí: D8 („procenta a poměr“) má kategorii
 * `prevody`, ne `redeni`. Heuristika podle prefixu by tiše počítala špatně.
 *
 * Proti dvojí pravdě stojí test, který tabulku porovná se šablonami oběma
 * směry — rozbije se ve chvíli, kdy někdo šablonu přidá a tabulku zapomene.
 */
const CATEGORY_OF: Readonly<Record<string, Category>> = {
  A1: "zaklad", A2: "zaklad", A3: "zaklad", A4: "zaklad",
  A5: "zaklad", A6: "zaklad", A7: "zaklad", A8: "zaklad",

  B1: "hmotnost", B2: "hmotnost", B3: "hmotnost", B4: "hmotnost",
  B5: "hmotnost", B6: "hmotnost", B7: "hmotnost", B8: "hmotnost",

  C1: "povrch", C2: "povrch", C3: "povrch", C4: "povrch", C5: "povrch",

  D1: "redeni", D2: "redeni", D3: "redeni", D4: "redeni",
  D5: "redeni", D6: "redeni", D7: "redeni",
  // Ne redeni: D8 počítá procenta a poměry, tedy převod zápisu koncentrace.
  D8: "prevody",

  E1: "rekonstituce", E2: "rekonstituce", E3: "rekonstituce",
  E4: "rekonstituce", E5: "rekonstituce",

  F1: "infuze", F2: "infuze", F3: "infuze", F4: "infuze", F5: "infuze", F6: "infuze",

  G1: "vazoaktivni", G2: "vazoaktivni", G3: "vazoaktivni", G4: "vazoaktivni",
  G5: "vazoaktivni", G6: "vazoaktivni", G7: "vazoaktivni",

  H1: "prevody", H2: "prevody", H3: "prevody",
  H4: "prevody", H5: "prevody", H6: "prevody",

  I1: "inzulin", I2: "inzulin", I3: "inzulin", I4: "inzulin",

  J1: "renalni", J2: "renalni", J3: "renalni", J4: "renalni", J5: "renalni",

  K1: "pediatrie", K2: "pediatrie", K3: "pediatrie",
  K4: "pediatrie", K5: "pediatrie", K6: "pediatrie",

  L1: "onkologie", L2: "onkologie", L3: "onkologie", L4: "onkologie",
};

/**
 * Kategorie šablony. `null` u šablony, kterou aplikace už nezná — historie
 * odpovědí přežije smazanou šablonu a statistika se kvůli tomu nesmí položit.
 */
export function categoryOfId(templateId: string): Category | null {
  return CATEGORY_OF[templateId] ?? null;
}

/** Kolik šablon má kategorie. Slouží k sestavení fondu stupně. */
export function templateIdsOf(category: Category): string[] {
  return Object.keys(CATEGORY_OF).filter((id) => CATEGORY_OF[id] === category);
}
