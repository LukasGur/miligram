import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import cs from "../../../messages/cs.json";
import "../templates";
import { allTemplates, buildExercise } from "../templates";
import { DIFFICULTIES, type Difficulty } from "../types";

/**
 * Zadání nesmí prozradit výsledek.
 *
 * Šablona H4 se na první obtížnosti ptala přesně na číslo, které stálo
 * v zadání v závorce („na obalu je 30 000 IU (300 mg), ordinováno
 * 30 000 IU — kolik je to miligramů?“). To není příklad, to je opis.
 *
 * Porovnává se vykreslený text, ne proměnné: šablona s větvemi (`select`)
 * nese hodnoty i pro větev, která se zrovna nepoužila, a ty v zadání
 * nejsou. Hledají se čísla v textu a srovnávají se s odpovědí naformátovanou
 * stejně, takže se poznají i tisíce s mezerou.
 *
 * Sem tam se odpověď s některým číslem v zadání potká náhodou — u malých
 * čísel jako 1 nebo 2 to nejde vyloučit. Proto se hlásí, až když je shoda
 * pravidlem: u téže šablony a obtížnosti skoro u všech semínek.
 */
const PROMPTS = (cs as { exercise: { prompts: Record<string, string> } }).exercise.prompts;
const SEEDS = Array.from({ length: 40 }, (_, index) => `s${index}`);

/** Kolik semínek smí odpověď v zadání zahlédnout, než je to pravidlo. */
const NAHODA = 0.9;

/** Čísla v textu, normalizovaná na porovnání (bez mezer v tisících). */
function numbersIn(text: string): Set<string> {
  const found = text.match(/\d[\d   ]*(?:[.,]\d+)?/g) ?? [];
  return new Set(found.map((one) => one.replace(/[  \s]/g, "")));
}

function promptOf(templateId: string, vars: Record<string, unknown>): string {
  return String(new IntlMessageFormat(PROMPTS[templateId], "cs").format(vars));
}

function answerText(value: number, decimals: number): string {
  const formatted = new Intl.NumberFormat("cs", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(value);
  return formatted.replace(/[  \s]/g, "");
}

describe("zadání neprozradí výsledek", () => {
  it("žádná šablona se soustavně neptá na číslo, které sama uvádí", () => {
    const nalezy: string[] = [];

    for (const template of allTemplates()) {
      expect(PROMPTS[template.id], `šablona ${template.id} nemá české zadání`).toBeDefined();

      for (const difficulty of DIFFICULTIES) {
        const prozrazeno = SEEDS.filter((seed) => leaks(template.id, seed, difficulty));
        const podil = prozrazeno.length / SEEDS.length;
        if (podil >= NAHODA) {
          nalezy.push(`${template.id}, obtížnost ${difficulty}: ${Math.round(podil * 100)} % zadání`);
        }
      }
    }

    expect(nalezy).toEqual([]);
  });
});

function leaks(templateId: string, seed: string, difficulty: Difficulty): boolean {
  const exercise = buildExercise(templateId, seed, difficulty);
  const text = promptOf(templateId, exercise.vars);
  return numbersIn(text).has(answerText(exercise.solution.value, exercise.answer.decimals));
}
