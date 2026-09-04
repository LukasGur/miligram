import { createRng } from "./random";
import { buildExercise, getTemplate, productionTemplates } from "./templates";
import type { Category, Difficulty, Exercise } from "./types";

/**
 * Sestavení lekce.
 *
 * Lekce je určená jediným řetězcem. Z něj se odvodí jak výběr šablon, tak
 * semínka jednotlivých příkladů, takže se dá kdykoli sestavit znovu — pro
 * opakování chyb, pro souboj i pro test. Neukládá se nic než ten řetězec.
 */

/** Délka lekce je pevná napříč aplikací; počítá se z ní ekonomika. */
export const LESSON_LENGTH = 7;

/**
 * Náběh obtížnosti. Lekce začíná lehce, aby se uživatel chytil, a končí
 * nejtěžším příkladem — poslední je ten, který si zapamatuje.
 */
const DIFFICULTY_RAMP: readonly Difficulty[] = [1, 1, 2, 2, 2, 3, 3];

export type LessonPlan = {
  id: string;
  items: readonly { templateId: string; seed: string; difficulty: Difficulty }[];
};

/**
 * Vybere šablony pro lekci. Dokud je z čeho brát, žádná se neopakuje —
 * dvakrát tentýž typ výpočtu za sebou působí, jako by aplikace došla.
 */
function chooseTemplates(lessonId: string, count: number): string[] {
  const rng = createRng(`lesson:${lessonId}`);
  const pool = productionTemplates().map((template) => template.id);
  const chosen: string[] = [];

  while (chosen.length < count) {
    const remaining = pool.filter((id) => !chosen.includes(id));
    const source = remaining.length > 0 ? remaining : pool;
    chosen.push(rng.pick(source));
  }
  return chosen;
}

export function planLesson(lessonId: string, length = LESSON_LENGTH): LessonPlan {
  const templateIds = chooseTemplates(lessonId, length);
  return {
    id: lessonId,
    items: templateIds.map((templateId, index) => ({
      templateId,
      seed: `${lessonId}:${index}`,
      difficulty: DIFFICULTY_RAMP[index % DIFFICULTY_RAMP.length],
    })),
  };
}

/** Sestaví konkrétní příklad lekce. Volá se až ve chvíli, kdy se má zobrazit. */
export function lessonExercise(plan: LessonPlan, index: number): Exercise {
  const item = plan.items[index];
  if (!item) throw new Error(`Lekce ${plan.id} nemá příklad číslo ${index}.`);
  return buildExercise(item.templateId, item.seed, item.difficulty);
}

/**
 * Nové id lekce. Náhodné, ale zapsatelné — dá se opsat i nadiktovat,
 * což bude potřeba u soubojů.
 */
export function newLessonId(): string {
  const now = Date.now().toString(36);
  const salt = Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, "0");
  return `${now}${salt}`;
}

/**
 * Lekce z konkrétního seznamu příkladů.
 *
 * Používá se na opakování chyb: uložená odpověď nese semínko, takže se dá
 * předložit přesně ten příklad, na kterém uživatel pohořel — ne jiný
 * podobný. Tohle je celý důvod, proč generátor stojí na semínkách.
 */
export function planFromItems(
  lessonId: string,
  items: readonly { templateId: string; seed: string; difficulty: Difficulty }[],
): LessonPlan {
  if (items.length === 0) throw new Error("Lekce potřebuje aspoň jeden příklad.");
  return { id: lessonId, items: [...items] };
}

/**
 * Lekce z jedné kategorie. Obtížnost se drží stejného náběhu jako denní
 * lekce — trénink kategorie není zkouška, jen užší výběr látky.
 */
export function planCategoryLesson(
  lessonId: string,
  category: Category,
  length = LESSON_LENGTH,
): LessonPlan {
  const pool = productionTemplates()
    .filter((template) => template.category === category)
    .map((template) => template.id);
  if (pool.length === 0) throw new Error(`Kategorie ${category} nemá žádnou šablonu.`);

  const rng = createRng(`category:${category}:${lessonId}`);
  const chosen: string[] = [];
  while (chosen.length < length) {
    const remaining = pool.filter((id) => !chosen.includes(id));
    chosen.push(rng.pick(remaining.length > 0 ? remaining : pool));
  }

  return {
    id: lessonId,
    items: chosen.map((templateId, index) => ({
      templateId,
      seed: `${lessonId}:${index}`,
      difficulty: DIFFICULTY_RAMP[index % DIFFICULTY_RAMP.length],
    })),
  };
}

/** Kategorie, ve kterých je z čeho losovat. */
export function trainableCategories(): Category[] {
  const seen = new Set<Category>();
  for (const template of productionTemplates()) seen.add(template.category);
  return [...seen];
}

/** Kategorie šablony — potřebuje ji statistika, aby uměla řadit podle látky. */
export function categoryOf(templateId: string): Category {
  return getTemplate(templateId).category;
}
