import { categoryOfId } from "@/core/templateCategories";
import type { Category, Difficulty } from "@/core/types";
import { db, type AnswerRecord } from "./db";

/**
 * Statistika z uložených odpovědí.
 *
 * Úspěšnost se počítá z prvního pokusu. Chybný příklad se v lekci vrací,
 * dokud ho student nespočítá, takže „vyřešeno“ nakonec platí skoro
 * o všem — jako měřítko by nic neřeklo. Zajímavé je, co sedlo napoprvé.
 *
 * Počítá se při čtení, ne průběžně. Odpovědí je řádově tisíce, ne miliony,
 * a předpočítaná čísla by se musela udržovat v souladu s historií —
 * což je přesně ten druh dvojí pravdy, kvůli které pak nesedí součty.
 */

export type CategoryStat = {
  category: Category;
  answered: number;
  correct: number;
  /** Podíl správných; u kategorie bez odpovědi je null, ne nula. */
  rate: number | null;
};

export type Overview = {
  lessons: number;
  answered: number;
  correct: number;
  rate: number | null;
  hinted: number;
  categories: CategoryStat[];
};

/** Kolik odpovědí musí kategorie mít, aby mělo smysl mluvit o úspěšnosti. */
export const MEANINGFUL_SAMPLE = 5;

export async function overview(): Promise<Overview> {
  const database = db();
  const [answers, lessons] = await Promise.all([
    database.answers.toArray(),
    database.lessons.count(),
  ]);

  const byCategory = new Map<Category, { answered: number; correct: number }>();
  for (const answer of answers) {
    // Šablona, kterou aplikace už nezná: historie ji přežije a statistika
    // kvůli ní nesmí spadnout.
    const category = categoryOfId(answer.templateId);
    if (category === null) continue;
    const bucket = byCategory.get(category) ?? { answered: 0, correct: 0 };
    bucket.answered += 1;
    if (answer.firstTry) bucket.correct += 1;
    byCategory.set(category, bucket);
  }

  const correct = answers.filter((answer) => answer.firstTry).length;

  return {
    lessons,
    answered: answers.length,
    correct,
    rate: answers.length === 0 ? null : correct / answers.length,
    hinted: answers.filter((answer) => answer.hinted).length,
    categories: [...byCategory.entries()]
      .map(([category, bucket]) => ({
        category,
        answered: bucket.answered,
        correct: bucket.correct,
        rate: bucket.answered === 0 ? null : bucket.correct / bucket.answered,
      }))
      .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1)),
  };
}

export type Mistake = { templateId: string; seed: string; difficulty: Difficulty };

/**
 * Chyby k opakování.
 *
 * Bere se poslední odpověď na každý příklad: co uživatel podruhé zvládl,
 * už mu předkládat nemá smysl. Řadí se od nejstarší chyby, aby se
 * nezapomnělo na to, co leží nejdéle.
 */
export async function mistakesToRepeat(limit: number): Promise<Mistake[]> {
  const answers = await db().answers.orderBy("id").toArray();

  const latest = new Map<string, AnswerRecord>();
  for (const answer of answers) {
    latest.set(`${answer.templateId}:${answer.seed}`, answer);
  }

  return [...latest.values()]
    // Příklad, který napoprvé nevyšel, stojí za zopakování i tehdy, když
    // ho student v téže lekci nakonec spočítal — sedlo mu to až po chybě.
    .filter((answer) => !answer.firstTry)
    .slice(0, limit)
    .map((answer) => ({
      templateId: answer.templateId,
      seed: answer.seed,
      difficulty: answer.difficulty as Difficulty,
    }));
}

