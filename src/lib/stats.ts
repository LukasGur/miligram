import { localDay } from "@/core/economy";
import { categoryOf } from "@/core/lesson";
import type { Category, Difficulty } from "@/core/types";
import { db, type AnswerRecord } from "./db";

/**
 * Statistika z uložených odpovědí.
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
  repaired: number;
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
    const category = safeCategory(answer.templateId);
    if (category === null) continue;
    const bucket = byCategory.get(category) ?? { answered: 0, correct: 0 };
    bucket.answered += 1;
    if (answer.correct) bucket.correct += 1;
    byCategory.set(category, bucket);
  }

  const correct = answers.filter((answer) => answer.correct).length;

  return {
    lessons,
    answered: answers.length,
    correct,
    rate: answers.length === 0 ? null : correct / answers.length,
    hinted: answers.filter((answer) => answer.hinted).length,
    repaired: answers.filter((answer) => answer.repaired).length,
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
    .filter((answer) => !answer.correct)
    .slice(0, limit)
    .map((answer) => ({
      templateId: answer.templateId,
      seed: answer.seed,
      difficulty: answer.difficulty as Difficulty,
    }));
}

/**
 * Kategorie šablony, která už v aplikaci nemusí být. Historie přežije
 * i smazanou šablonu a statistika kvůli tomu nesmí spadnout.
 */
function safeCategory(templateId: string): Category | null {
  try {
    return categoryOf(templateId);
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
   Dnešek a týden

   Domovská obrazovka stojí na jedné otázce: jak jsem na tom dnes.
   Odpověď se počítá z odpovědí, ne z profilu — profil drží celkové součty
   a ty o dnešku nic neříkají.
   ------------------------------------------------------------------------ */

/** Kolik příkladů uživatel zodpověděl dnes. */
export async function answeredToday(today = localDay()): Promise<number> {
  const answers = await db().answers.toArray();
  return answers.filter((answer) => answer.answeredAt.slice(0, 10) === today).length;
}

export type WeekDay = {
  day: string;
  /** Dohrál v ten den uživatel aspoň jednu lekci? */
  active: boolean;
  today: boolean;
  /** Den, který teprve přijde. Není to zmeškaný den, jen ještě nenastal. */
  upcoming: boolean;
};

/**
 * Probíhající kalendářní týden, pondělím počínaje.
 *
 * Ne posledních sedm dní končících dneškem: takový pás sice ukazuje totéž
 * množství historie, ale začíná pokaždé jiným dnem a nikdo ho tak nečte.
 * Týden má v ČR i SR pevný začátek a obrazovka se mu má přizpůsobit.
 */
export async function weekActivity(today = localDay()): Promise<WeekDay[]> {
  const lessons = await db().lessons.toArray();
  const played = new Set(lessons.map((lesson) => lesson.finishedAt.slice(0, 10)));

  const [year, month, date] = today.split("-").map(Number);
  const reference = new Date(Date.UTC(year, month - 1, date));
  // getUTCDay() vrací neděli jako nulu; posun udělá z pondělí začátek.
  const sinceMonday = (reference.getUTCDay() + 6) % 7;

  return Array.from({ length: 7 }, (_, index) => {
    const moment = new Date(Date.UTC(year, month - 1, date - sinceMonday + index));
    const day = moment.toISOString().slice(0, 10);
    return { day, active: played.has(day), today: day === today, upcoming: day > today };
  });
}
