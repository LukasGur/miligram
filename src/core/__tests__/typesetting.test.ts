import { describe, expect, it } from "vitest";
import katex from "katex";
import cs from "../../../messages/cs.json";
import sk from "../../../messages/sk.json";
import "../templates";
import { allTemplates, buildExercise } from "../templates";
import { DIFFICULTIES } from "../types";

const SEEDS = Array.from({ length: 10 }, (_, i) => `k${i}`);
const LOCALES = [["cs", cs], ["sk", sk]] as const;
const TOKEN = /@([a-zA-Z]+)/g;

/** Všechny vzorce, které se v šablonách vůbec můžou objevit. */
function everyFormula(): { id: string; latex: string }[] {
  const found: { id: string; latex: string }[] = [];
  for (const template of allTemplates()) {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { solution } = buildExercise(template.id, seed, difficulty);
        for (const step of solution.steps) {
          for (const latex of [step.formula, step.substituted, step.result]) {
            if (latex) found.push({ id: `${template.id}/${difficulty}/${seed}`, latex });
          }
        }
      }
    }
  }
  return found;
}

/**
 * Vzorce v krocích řešení jsou řetězce, které nikdo nekompiluje — chyba
 * v zápisu se pozná až na obrazovce, a to jen u toho příkladu, který se
 * zrovna vylosuje. Tenhle test proto prožene sazbou všechny kroky všech
 * šablon a nechá KaTeX chybu vyhodit.
 */
describe("sazba vzorců", () => {
  const formulas = everyFormula();

  it("jádro nesází text v žádném jazyce, jen tokeny", () => {
    // Vzorec „objem = dávka / koncentrace“ potřebuje slova, ale ta do jádra
    // nepatří. Jádro proto zapisuje `\text{@dose}` a jazyk se doplní až
    // ve vrstvě zobrazení. Ne-ASCII znak tady znamená, že se do vzorce
    // vloudilo české slovo.
    const offenders = formulas
      .filter(({ latex }) => /[^\x20-\x7E]/.test(latex))
      .map(({ id, latex }) => `${id}: ${latex}`);
    expect(offenders.slice(0, 5)).toEqual([]);
  });

  it("každý token má překlad v obou jazycích", () => {
    const used = new Set<string>();
    for (const { latex } of formulas) {
      for (const [, key] of latex.matchAll(TOKEN)) used.add(key);
    }
    expect(used.size).toBeGreaterThan(20);

    for (const [locale, messages] of LOCALES) {
      const terms = messages.exercise.terms as Record<string, string>;
      for (const key of used) {
        expect(terms[key], `${locale}/@${key}`).toBeTruthy();
      }
    }
  });

  it("přeložený vzorec projde KaTeXem v přísném režimu", () => {
    const failures: string[] = [];
    for (const [locale, messages] of LOCALES) {
      const terms = messages.exercise.terms as Record<string, string>;
      for (const { id, latex } of formulas) {
        const localized = latex.replace(TOKEN, (_match, key: string) => terms[key] ?? _match);
        try {
          katex.renderToString(localized, { throwOnError: true, strict: "error" });
        } catch (error) {
          failures.push(`${locale}/${id}: ${localized} — ${(error as Error).message}`);
        }
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it("desetinná čárka se sází jako čárka, ne jako oddělovač", () => {
    // `{,}` je v matematické sazbě jediný správný zápis desetinné čárky.
    // Holá čárka by dostala mezeru za sebou a z „1,5 ml“ by bylo „1, 5 ml“.
    const offenders = formulas
      .filter(({ latex }) => /\d,\d/.test(latex))
      .map(({ id, latex }) => `${id}: ${latex}`);
    expect(offenders.slice(0, 5)).toEqual([]);
  });
});
