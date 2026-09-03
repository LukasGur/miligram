import type { Tolerance } from "./answer";
import type { Rng } from "./random";

export const CATEGORIES = [
  "zaklad",
  "hmotnost",
  "povrch",
  "redeni",
  "rekonstituce",
  "infuze",
  "vazoaktivni",
  "prevody",
  "inzulin",
  "renalni",
  "pediatrie",
  "onkologie",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DIFFICULTIES = [1, 2, 3] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Doklad původu faktických údajů. Bez něj se šablona nesmí dostat
 * do produkčního setu — viz docs/zdroje.md.
 */
export type Source = {
  /** Citace tak, jak se zobrazí uživateli. */
  citation: string;
  url?: string;
  /** Kód SÚKL konkrétního registrovaného balení, je-li přípravek český. */
  suklCode?: string;
  /** Datum ověření ve formátu ISO. */
  verifiedAt: string;
};

/** Hodnoty vylosované generátorem; klíče odpovídají zástupným symbolům v překladech. */
export type Vars = Record<string, number | string>;

/**
 * Jeden krok řešení. Text je vždy klíč do překladů, nikdy hotová věta —
 * vzorce se sázejí KaTeXem, proto jdou zvlášť od textu.
 */
export type SolutionStep = {
  /** Klíč popisného textu kroku. */
  textKey: string;
  /** Vzorec v LaTeXu bez dosazení. */
  formula?: string;
  /** Tentýž vzorec s dosazenými hodnotami. */
  substituted?: string;
  /** Mezivýsledek kroku. */
  result?: string;
};

export type Solution = {
  /** Správná hodnota v základní jednotce odpovědi. */
  value: number;
  steps: SolutionStep[];
  /** Klíč poznámky o zaokrouhlení v praxi. */
  roundingNoteKey?: string;
};

/**
 * Jednotka, která se u pole odpovědi zobrazuje jako pevný sufix.
 * Je to klíč do překladů, ne fyzikální jednotka — počet tablet ani cyklů
 * do soustavy SI nepatří, ale jako sufix se chová stejně.
 */
export const ANSWER_UNITS = [
  "mg", "g", "ug", "ml", "l", "mmol", "mEq", "IU",
  "min", "h", "den",
  "mlPerHour", "dropsPerMinute", "ugPerKgMin", "ugPerMin", "mgPerMl", "mmolPerL",
  "tablet", "ampoule", "vial", "pack", "cycle",
  "m2", "percent",
] as const;
export type AnswerUnit = (typeof ANSWER_UNITS)[number];

export type AnswerSpec = {
  unit: AnswerUnit;
  tolerance: Tolerance;
  /** Na kolik desetinných míst se výsledek zobrazuje. */
  decimals: number;
};

export type Template = {
  id: string;
  category: Category;
  /**
   * Zdroje faktických údajů. Šablona jich může mít víc — přípravek,
   * dávkovací rozmezí a specifikace prostředku pocházejí odjinud.
   */
  source: Source | readonly Source[];
  /**
   * Šablona s nedohledaným údajem. Generátor ji do produkčního setu
   * nezařadí, dokud se příznak neodstraní.
   */
  needsReview?: boolean;
  /**
   * Tolerance často závisí na výsledku — u objemu ji určuje velikost
   * stříkačky, do které se vejde. Proto smí být i funkcí.
   */
  answer: AnswerSpec | ((vars: Vars, solution: Solution) => AnswerSpec);
  /** Vylosuje zadání pro danou obtížnost. */
  generate(rng: Rng, difficulty: Difficulty): Vars;
  /** Spočítá výsledek a rozepíše postup. Musí být čistá funkce vstupů. */
  solve(vars: Vars, difficulty: Difficulty): Solution;
};

export type Exercise = {
  templateId: string;
  seed: string;
  difficulty: Difficulty;
  vars: Vars;
  answer: AnswerSpec;
  solution: Solution;
};
