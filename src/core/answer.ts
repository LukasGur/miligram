/**
 * Přijetí a vyhodnocení odpovědi.
 *
 * Tolerance je vlastnost šablony, ne globální konstanta: u počtu tablet
 * je jediná správná hodnota, u rychlosti infuze v ml/h se v praxi
 * zaokrouhluje a odchylka desetiny je bezvýznamná.
 */

export type Tolerance =
  | { kind: "exact" }
  /** Přijme odchylku do dané absolutní hodnoty, např. ±0,1 ml. */
  | { kind: "absolute"; value: number }
  /** Přijme odchylku do daného podílu správné hodnoty, např. 0,01 = ±1 %. */
  | { kind: "relative"; value: number }
  /** Přijme cokoli, co se po zaokrouhlení na daný počet míst shoduje. */
  | { kind: "decimals"; places: number };

export type Verdict = {
  correct: boolean;
  /**
   * Chyba o řád je v praxi nejnebezpečnější a v řešení se na ni upozorňuje
   * zvlášť. Uvádí, kolikrát se odpověď liší — 10 znamená desetkrát víc,
   * 0,1 desetkrát míň.
   */
  magnitudeError?: { factor: number; exponent: number };
};

const EPSILON = 1e-9;

/**
 * Přijme české i anglické psaní desetinné čárky a mezery v tisících.
 * Vrací null, pokud vstup není číslo — prázdné pole není nula.
 */
export function parseAnswer(input: string): number | null {
  const cleaned = input
    .replace(/\s| | /g, "")
    .replace(",", ".");
  if (cleaned === "" || !/^[+-]?\d*\.?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function withinTolerance(answer: number, expected: number, tolerance: Tolerance): boolean {
  switch (tolerance.kind) {
    case "exact":
      return Math.abs(answer - expected) < EPSILON;
    case "absolute":
      return Math.abs(answer - expected) <= tolerance.value + EPSILON;
    case "relative":
      return Math.abs(answer - expected) <= Math.abs(expected) * tolerance.value + EPSILON;
    case "decimals": {
      const factor = 10 ** tolerance.places;
      return Math.round(answer * factor) === Math.round(expected * factor);
    }
  }
}

/**
 * Rozpozná posun o řád. Hledá se jen v rozsahu 10⁻³ až 10³ — dál už to
 * není překlep v převodu, ale jiná chyba, a tvrdit opak by mátlo.
 */
function detectMagnitudeError(answer: number, expected: number): Verdict["magnitudeError"] {
  if (answer === 0 || expected === 0) return undefined;
  const ratio = answer / expected;
  if (ratio <= 0) return undefined;

  const exponent = Math.round(Math.log10(ratio));
  if (exponent === 0 || Math.abs(exponent) > 3) return undefined;

  const factor = 10 ** exponent;
  // Tolerance 2 % odchytí i případ, kdy uživatel navíc zaokrouhlil.
  if (Math.abs(ratio - factor) / factor > 0.02) return undefined;

  return { factor, exponent };
}

export function evaluateAnswer(answer: number, expected: number, tolerance: Tolerance): Verdict {
  if (withinTolerance(answer, expected, tolerance)) return { correct: true };
  return { correct: false, magnitudeError: detectMagnitudeError(answer, expected) };
}
