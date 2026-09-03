import type { SolutionStep } from "../types";

/**
 * Číslo pro sazbu do vzorce.
 *
 * Desetinná čárka se zapisuje jako `{,}`. Holá čárka je v matematické sazbě
 * oddělovač a KaTeX za ni dá mezeru, takže by z „1,5 ml“ vzniklo „1, 5 ml“.
 * Čárku má čeština i slovenština, jiný jazyk aplikace nemá — kdyby přibyl,
 * musí se oddělovač protáhnout až sem z vrstvy zobrazení.
 */
export function tex(value: number, decimals = 2): string {
  return String(Number(value.toFixed(decimals))).replace(".", "{,}");
}

/** Zlomek v KaTeXu. Zlomky mají vypadat jako zlomky, ne jako lomítko. */
export function frac(numerator: string, denominator: string): string {
  return `\\dfrac{${numerator}}{${denominator}}`;
}

/**
 * Jednotka sazená vzpřímeně — kurzíva by z „mg“ udělala součin m×g.
 *
 * Znak µ se cestou nahradí příkazem `\mu`. Symbol mikro (U+00B5) totiž
 * v matematické sazbě není písmeno, které by KaTeX znal, a v přísném režimu
 * ho odmítne; v benevolentním by ho vysázel fallbackem z jiného řezu.
 */
export function unit(symbol: string): string {
  const body = symbol.replaceAll("\u00b5", "\\mu ");
  /**
   * Slovní jednotky nesou token pro překlad (`@days`) a sázejí se textovým
   * režimem. `\mathrm` je režim matematický a diakritiku v něm KaTeX odmítá —
   * „dnů“ by v něm skončilo chybou nebo fallbackem z jiného řezu.
   */
  return symbol.includes("@") ? `\\,\\text{${body}}` : `\\,\\mathrm{${body}}`;
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

/**
 * Přehled zadaných hodnot.
 *
 * Oddělovačem je čárka a za ní tlustá mezera `\;`. V JavaScriptu se musí
 * zpětné lomítko zdvojit — jinak z něj zbude holý středník a v sazbě se
 * objeví „0,5 %,; 100 ml“.
 */
export function given(...parts: string[]): SolutionStep {
  return step("zadani", { result: parts.join(",\\; ") });
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
