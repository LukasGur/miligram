import { createRng, type Rng } from "./random";
import { RAMPS, stageById, type DailySpec } from "./curriculum";
import {
  DAILY_REVIEW_ITEMS,
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
/**
 * Sestaví konkrétní příklad lekce. Volá se až ve chvíli, kdy se má zobrazit.
 *
 * `attempt` je pořadí pokusu na téže položce. Vrácený příklad dostane jiné
 * semínko, takže tentýž typ výpočtu přijde s jinými čísly — jinak by stačilo
 * opsat správnou hodnotu z verdiktu a nic se tím nenaučil. Identita položky
 * v plánu zůstává `item.seed`; mění se jen čísla.
 */
export function lessonExercise(plan: LessonPlan, index: number, attempt = 0): Exercise {
  const item = plan.items[index];
  if (!item) throw new Error(`Lekce ${plan.id} nemá příklad číslo ${index}.`);
  const seed = attempt === 0 ? item.seed : `${item.seed}#${attempt}`;
  return buildExercise(item.templateId, seed, item.difficulty);
}

/**
 * Lekce z konkrétního seznamu šablon.
 *
 * Používá se na opakování chyb. Bere se šablona a obtížnost, ne uložené
 * semínko: kdyby přišel tentýž příklad s týmiž čísly, stačilo by si
 * zapamatovat výsledek. Student má znovu spočítat totéž, ne si vzpomenout.
 */
export function planFromItems(
  lessonId: string,
  items: readonly { templateId: string; difficulty: Difficulty }[],
): LessonPlan {
  if (items.length === 0) throw new Error("Lekce potřebuje aspoň jeden příklad.");
  return {
    id: lessonId,
    items: items.map((item, index) => ({
      templateId: item.templateId,
      seed: `${lessonId}:${index}`,
      difficulty: item.difficulty,
    })),
  };
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
 * Pět příkladů z rozepsaného stupně a dva na opakování — nové se učí,
 * staré se udržuje. Opakování sedí na pozicích z `REVIEW_SLOTS`, ne na
 * konci.
 *
 * Na opakování mají přednost neopravené chyby, a to tentýž typ výpočtu
 * v téže obtížnosti. Bez nich by student, kterému nesedí jeden typ, mohl
 * lekcí projít na typech, které umí — los ze stupně na chyby nehledí.
 * Zbylá místa se doplní ze zvládnuté látky.
 *
 * Losuje se ze dvou nezávislých semínek, aby změna stupně nepřeskládala
 * opakování a naopak. Délka lekce se nemění nikdy: ekonomika i kruh
 * denního cíle na sedmičce stojí, takže když není co opakovat, naplní se
 * všechno ze stupně.
 */
export function planDailyLesson(lessonId: string, spec: DailySpec): LessonPlan {
  const ramp = RAMPS[spec.ramp];
  const production = productionTemplates();
  const known = new Set(production.map((template) => template.id));

  // Chyba ze šablony, která mezitím z produkce vypadla, se sestavit nedá.
  const mistakes = (spec.mistakes ?? [])
    .filter((mistake) => known.has(mistake.templateId))
    .slice(0, DAILY_REVIEW_ITEMS);

  const inReview = new Set(spec.review);
  const reviewPool = production
    .filter((template) => inReview.has(template.category))
    .map((template) => template.id);
  const reviewCount = reviewPool.length > 0 ? DAILY_REVIEW_ITEMS - mistakes.length : 0;
  const reviewIds =
    reviewCount > 0 ? drawTemplates(createRng(`review:${lessonId}`), reviewPool, reviewCount) : [];

  const extra: { templateId: string; difficulty?: Difficulty; origin?: "mistake" }[] = [
    ...mistakes.map((mistake) => ({ ...mistake, origin: "mistake" as const })),
    ...reviewIds.map((templateId) => ({ templateId })),
  ];
  const slots = new Set(REVIEW_SLOTS.slice(0, extra.length));

  // Typ, který přijde jako chyba, se ze stupně znovu nelosuje — dokud je
  // z čeho brát. Dvakrát totéž v jedné lekci by opakování jen zdvojilo.
  const inStage = new Set(stageById(spec.stage).categories);
  const repeated = new Set(mistakes.map((mistake) => mistake.templateId));
  const stageAll = production
    .filter((template) => inStage.has(template.category))
    .map((template) => template.id);
  const stageFresh = stageAll.filter((id) => !repeated.has(id));
  const stageIds = drawTemplates(
    createRng(`stage:${spec.stage}:${lessonId}`),
    stageFresh.length > 0 ? stageFresh : stageAll,
    LESSON_LENGTH - slots.size,
  );

  let fromStage = 0;
  let fromExtra = 0;
  const items = Array.from({ length: LESSON_LENGTH }, (_, index) => {
    const seed = `${lessonId}:${index}`;
    if (!slots.has(index)) {
      return { templateId: stageIds[fromStage++], seed, difficulty: ramp[index % ramp.length] };
    }
    const item = extra[fromExtra++];
    return {
      templateId: item.templateId,
      seed,
      // Chyba se opakuje v obtížnosti, ve které padla. Snadnější verze
      // by ji „opravila“, aniž by student spočítal to, co mu nešlo.
      difficulty: item.difficulty ?? ramp[index % ramp.length],
      ...(item.origin ? { origin: item.origin } : {}),
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
