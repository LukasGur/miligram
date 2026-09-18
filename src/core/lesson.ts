import { createRng, type Rng } from "./random";
import { RAMPS, stageById, type DailySpec } from "./curriculum";
import {
  DAILY_REVIEW_ITEMS,
  DAILY_STAGE_ITEMS,
  DIFFICULTY_RAMP,
  LESSON_LENGTH,
  newLessonId,
  REVIEW_SLOTS,
  type LessonPlan,
} from "./lessonPlan";
import { buildExercise, getTemplate, productionTemplates } from "./templates";
import type { Category, Difficulty, Exercise } from "./types";

// Délka, náběh obtížnosti a nové id žijí vedle, aby se daly použít bez
// fondu přípravků. Odsud se vydávají dál, ať se nemusí hledat na dvou
// místech.
export { DIFFICULTY_RAMP, LESSON_LENGTH, newLessonId, type LessonPlan };

/**
 * Sestavení lekce.
 *
 * Lekci určuje **buď** identifikátor, **nebo** uložený plán:
 *
 * - *sdílená lekce* (souboj) se sestaví z identifikátoru a nesmí záviset
 *   na stavu uživatele — dva hráči nemají stejný stav a každý by dostal
 *   jiné příklady;
 * - *osobní lekce* (denní podle programu, trénink kategorie, opakování
 *   chyb) si plán uloží k rozehrané lekci.
 *
 * Semínka příkladů jsou v obou případech `${lessonId}:${index}`, takže se
 * příklad dá kdykoli sestavit znovu a ukládá se jen ono semínko.
 */

/**
 * Vybere šablony pro lekci. Dokud je z čeho brát, žádná se neopakuje —
 * dvakrát tentýž typ výpočtu za sebou působí, jako by aplikace došla.
 */
function drawTemplates(rng: Rng, pool: readonly string[], count: number): string[] {
  if (pool.length === 0) throw new Error("Lekce se nedá sestavit z prázdného fondu šablon.");
  const chosen: string[] = [];

  while (chosen.length < count) {
    const unused = pool.filter((id) => !chosen.includes(id));
    if (unused.length > 0) {
      chosen.push(rng.pick(unused));
      continue;
    }
    // Fond došel — šablona se zopakuje, ale ne hned vedle sebe a s jiným
    // semínkem, takže student dostane tentýž typ výpočtu s jinými čísly.
    const notLast = pool.filter((id) => id !== chosen[chosen.length - 1]);
    chosen.push(rng.pick(notLast.length > 0 ? notLast : pool));
  }
  return chosen;
}

function chooseTemplates(lessonId: string, count: number): string[] {
  return drawTemplates(
    createRng(`lesson:${lessonId}`),
    productionTemplates().map((template) => template.id),
    count,
  );
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

/**
 * Denní lekce podle programu.
 *
 * Pět příkladů z rozepsaného stupně a dva z látky, kterou už student
 * zvládl — nové se učí, staré se udržuje. Opakování sedí na pozicích
 * z `REVIEW_SLOTS`, ne na konci.
 *
 * Losuje se ze dvou nezávislých semínek, aby změna stupně nepřeskládala
 * opakování a naopak. Délka lekce se nemění nikdy: ekonomika i kruh
 * denního cíle na sedmičce stojí, takže když není co opakovat, naplní se
 * všechno ze stupně.
 */
export function planDailyLesson(lessonId: string, spec: DailySpec): LessonPlan {
  const ramp = RAMPS[spec.ramp];
  const reviewing = spec.review.length > 0;
  const slots = new Set(reviewing ? REVIEW_SLOTS : []);

  const inStage = new Set(stageById(spec.stage).categories);
  const stagePool = productionTemplates()
    .filter((template) => inStage.has(template.category))
    .map((template) => template.id);
  const stageIds = drawTemplates(
    createRng(`stage:${spec.stage}:${lessonId}`),
    stagePool,
    reviewing ? DAILY_STAGE_ITEMS : LESSON_LENGTH,
  );

  const inReview = new Set(spec.review);
  const reviewPool = productionTemplates()
    .filter((template) => inReview.has(template.category))
    .map((template) => template.id);
  const reviewIds = reviewing
    ? drawTemplates(createRng(`review:${lessonId}`), reviewPool, DAILY_REVIEW_ITEMS)
    : [];

  let fromStage = 0;
  let fromReview = 0;
  const items = Array.from({ length: LESSON_LENGTH }, (_, index) => {
    const templateId = slots.has(index) ? reviewIds[fromReview++] : stageIds[fromStage++];
    return {
      templateId,
      seed: `${lessonId}:${index}`,
      difficulty: ramp[index % ramp.length],
    };
  });

  return { id: lessonId, items };
}

/**
 * Který plán se má hrát. Rozhodnutí patří do jádra, ne do komponenty:
 * vitest sbírá jen soubory s příponou `.test.ts`, takže v obrazovce by
 * ho nic nehlídalo.
 */
export function resolvePlan(input: {
  lessonId: string;
  plan?: LessonPlan;
  spec?: DailySpec;
}): LessonPlan {
  if (input.plan) return input.plan;
  if (input.spec) return planDailyLesson(input.lessonId, input.spec);
  // Holý identifikátor: sdílená lekce, tedy souboj.
  return planLesson(input.lessonId);
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
