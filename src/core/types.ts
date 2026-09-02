import type { Tolerance } from "./answer";
import type { Rng } from "./random";
import type { Unit } from "./units";

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

export type AnswerSpec = {
  unit: Unit;
  tolerance: Tolerance;
  /** Na kolik desetinných míst se výsledek zobrazuje. */
  decimals: number;
};

export type Template = {
  id: string;
  category: Category;
  source: Source;
  /**
   * Šablona s nedohledaným údajem. Generátor ji do produkčního setu
   * nezařadí, dokud se příznak neodstraní.
   */
  needsReview?: boolean;
  answer: AnswerSpec;
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
