import type { SolutionStep } from "../types";

/** Číslo pro sazbu do vzorce. Desetinná čárka patří až do vrstvy zobrazení. */
export function tex(value: number, decimals = 2): string {
  return String(Number(value.toFixed(decimals)));
}

/** Zlomek v KaTeXu. Zlomky mají vypadat jako zlomky, ne jako lomítko. */
export function frac(numerator: string, denominator: string): string {
  return `\\dfrac{${numerator}}{${denominator}}`;
}

/** Jednotka sazená vzpřímeně — kurzíva by z „mg“ udělala součin m×g. */
export function unit(symbol: string): string {
  return `\\,\\mathrm{${symbol}}`;
}

/** Číslo s jednotkou, jak se sází do vzorce. */
export function q(value: number, symbol: string, decimals = 2): string {
  return `${tex(value, decimals)}${unit(symbol)}`;
}

export function step(textKey: string, parts: Omit<SolutionStep, "textKey"> = {}): SolutionStep {
  return { textKey, ...parts };
}

/* -------------------------------------------------------------------------
   Stavebnice kroků

   Struktura řešení je u všech šablon stejná: co víme, který vzorec a proč,
   dosazení, krácení, výsledek. Kdyby si ji každá šablona psala sama,
   rozjela by se a uživatel by přišel o to, že řešení vypadá pořád stejně.
   ---------------------------------------------------------------------- */

/** Přehled zadaných hodnot. */
export function given(...parts: string[]): SolutionStep {
  return step("zadani", { result: parts.join(",\; ") });
}

/** Vzorec bez dosazení — krok, kde se vysvětluje, proč zrovna tenhle. */
export function formula(latex: string): SolutionStep {
  return step("vzorec", { formula: latex });
}

/** Vzorec s dosazenými hodnotami, volitelně s mezivýsledkem. */
export function substitute(latex: string, result?: string): SolutionStep {
  return step("dosazeni", result === undefined ? { substituted: latex } : { substituted: latex, result });
}

/** Mezikrok s vlastním popisem, například výpočet koncentrace před objemem. */
export function intermediate(
  textKey: string,
  parts: { formula?: string; substituted?: string; result?: string },
): SolutionStep {
  return step(textKey, parts);
}

export function result(value: number, symbol: string, decimals = 2): SolutionStep {
  return step("vysledek", { result: q(value, symbol, decimals) });
}

/* -------------------------------------------------------------------------
   Losování dávky

   Dávka se nikdy nelosuje jako absolutní číslo. U ampule 2 mg/2 ml
   a u ampule 500 mg/10 ml vypadá „rozumná dávka“ úplně jinak, takže se
   losuje podíl obsahu a teprve z něj vzniká číslo v zadání.
   ---------------------------------------------------------------------- */

/** Zaokrouhlí na tři platné číslice, aby zadání nemělo nesmyslný ocas. */
export function tidy(value: number): number {
  return Number(value.toPrecision(3));
}
