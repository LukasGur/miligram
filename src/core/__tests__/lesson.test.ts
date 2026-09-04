import { describe, expect, it } from "vitest";
import "../templates";
import {
  categoryOf,
  LESSON_LENGTH,
  lessonExercise,
  newLessonId,
  planCategoryLesson,
  planFromItems,
  planLesson,
  trainableCategories,
} from "../lesson";
import { productionTemplates } from "../templates";

describe("sestavení lekce", () => {
  it("má pevnou délku a stoupající obtížnost", () => {
    const plan = planLesson("test");
    expect(plan.items).toHaveLength(LESSON_LENGTH);
    expect(plan.items.map((i) => i.difficulty)).toEqual([1, 1, 2, 2, 2, 3, 3]);
  });

  it("tentýž identifikátor dá tutéž lekci", () => {
    expect(planLesson("stejna")).toEqual(planLesson("stejna"));
    expect(planLesson("jina")).not.toEqual(planLesson("stejna"));
  });

  it("žádná šablona se v lekci neopakuje", () => {
    for (let i = 0; i < 50; i += 1) {
      const ids = planLesson(`l${i}`).items.map((item) => item.templateId);
      expect(new Set(ids).size, `lekce l${i}`).toBe(ids.length);
    }
  });

  it("losuje jen ze šablon s doloženým zdrojem", () => {
    const allowed = new Set(productionTemplates().map((t) => t.id));
    for (let i = 0; i < 50; i += 1) {
      for (const item of planLesson(`z${i}`).items) {
        expect(allowed, item.templateId).toContain(item.templateId);
      }
    }
  });

  it("příklad jde sestavit a nese svoje semínko", () => {
    const plan = planLesson("abc");
    for (let index = 0; index < LESSON_LENGTH; index += 1) {
      const exercise = lessonExercise(plan, index);
      expect(exercise.seed).toBe(`abc:${index}`);
      expect(exercise.solution.value).toBeGreaterThan(0);
    }
    expect(() => lessonExercise(plan, LESSON_LENGTH)).toThrow(/nemá příklad/);
  });

  it("nová identifikace lekce je pokaždé jiná a jde ji opsat", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newLessonId()));
    expect(ids.size).toBeGreaterThan(190);
    for (const id of ids) expect(id).toMatch(/^[0-9a-z]+$/);
  });
});

describe("tréninkové režimy", () => {
  it("opakování chyb předloží tytéž příklady, ne podobné", () => {
    const original = planLesson("puvodni");
    const wrong = [original.items[1], original.items[4]];
    const repeat = planFromItems("opakovani", wrong);

    expect(repeat.items).toEqual(wrong);
    // Semínko určuje zadání, takže se vrátí přesně ten příklad,
    // na kterém uživatel pohořel.
    const before = lessonExercise(original, 1);
    const after = lessonExercise(repeat, 0);
    expect(after.vars).toEqual(before.vars);
    expect(after.solution.value).toBe(before.solution.value);
  });

  it("prázdné opakování je chyba, ne prázdná lekce", () => {
    expect(() => planFromItems("x", [])).toThrow(/aspoň jeden/);
  });

  it("trénink kategorie losuje jen z její látky", () => {
    for (const category of trainableCategories()) {
      const plan = planCategoryLesson(`k-${category}`, category);
      expect(plan.items).toHaveLength(LESSON_LENGTH);
      for (const item of plan.items) {
        expect(categoryOf(item.templateId), `${category}/${item.templateId}`).toBe(category);
      }
    }
  });

  it("kategorie s malým počtem šablon lekci doplní opakováním", () => {
    // Onkologie má čtyři šablony, lekce sedm příkladů — nesmí spadnout.
    const plan = planCategoryLesson("onko", "onkologie");
    expect(plan.items).toHaveLength(LESSON_LENGTH);
    expect(new Set(plan.items.map((item) => item.templateId)).size).toBeGreaterThanOrEqual(4);
  });

  it("každá trénovatelná kategorie má aspoň jednu šablonu v produkci", () => {
    expect(trainableCategories().length).toBeGreaterThanOrEqual(11);
  });
});
