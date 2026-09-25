import { categoryOfId } from "@/core/templateCategories";
import type { Category, Difficulty } from "@/core/types";
import { db } from "./db";

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

/**
 * Chyba k opakování. Nese šablonu a obtížnost, ne semínko: opakování má
 * dát tentýž výpočet s jinými čísly, ať se nedá projít po paměti.
 */
export type Mistake = { templateId: string; difficulty: Difficulty };

/**
 * Chyby k opakování.
 *
 * Chyba patří typu výpočtu — šabloně v dané obtížnosti —, ne jednomu
 * konkrétnímu příkladu. Opakování totiž dává tentýž výpočet s novými
 * čísly, takže nové semínko by staré chybě nikdy nemohlo odpovídat
 * a opravená chyba by v seznamu visela navždy.
 *
 * Chyba zmizí, jakmile student tentýž typ spočítá správně napoprvé —
 * v opakování, v denní lekci, kdekoli. Příklad, který napoprvé nevyšel,
 * stojí za zopakování i tehdy, když ho v téže lekci nakonec spočítal:
 * sedlo mu to až po chybě.
 *
 * Řadí se od nejstarší neopravené chyby, aby se nezapomnělo na to, co
 * leží nejdéle.
 */
export async function mistakesToRepeat(limit: number): Promise<Mistake[]> {
  const answers = await db().answers.orderBy("id").toArray();

  const open = new Map<string, Mistake>();
  for (const answer of answers) {
    // Šablona, kterou aplikace už nezná, se opakovat nedá.
    if (categoryOfId(answer.templateId) === null) continue;

    const key = `${answer.templateId}:${answer.difficulty}`;
    if (answer.firstTry) {
      open.delete(key);
    } else if (!open.has(key)) {
      open.set(key, { templateId: answer.templateId, difficulty: answer.difficulty as Difficulty });
    }
  }

  return [...open.values()].slice(0, limit);
}
