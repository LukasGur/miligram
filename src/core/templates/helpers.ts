import type { SolutionStep } from "../types";

/** Číslo pro sazbu do vzorce. Desetinná čárka patří až do vrstvy zobrazení. */
export function tex(value: number, decimals = 2): string {
  const rounded = Number(value.toFixed(decimals));
  return String(rounded);
}

/** Zlomek v KaTeXu. Zlomky mají vypadat jako zlomky, ne jako lomítko. */
export function frac(numerator: string, denominator: string): string {
  return `\\dfrac{${numerator}}{${denominator}}`;
}

/** Jednotka sazená vzpřímeně — kurzíva by z „mg“ udělala součin m×g. */
export function unit(symbol: string): string {
  return `\\,\\mathrm{${symbol}}`;
}

export function step(
  textKey: string,
  parts: Omit<SolutionStep, "textKey"> = {},
): SolutionStep {
  return { textKey, ...parts };
}
