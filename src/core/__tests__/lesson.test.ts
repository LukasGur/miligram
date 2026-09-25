import { describe, expect, it } from "vitest";
import "../templates";
import {
  categoryOf,
  LESSON_LENGTH,
  lessonExercise,
  newLessonId,
  planCategoryLesson,
  planDailyLesson,
  planFromItems,
  planLesson,
  resolvePlan,
  trainableCategories,
} from "../lesson";
import { DAILY_REVIEW_ITEMS, DAILY_STAGE_ITEMS, REVIEW_SLOTS } from "../lessonPlan";
import { RAMPS, stageById, type DailySpec } from "../curriculum";
import { productionTemplates } from "../templates";

const DENNI: DailySpec = { stage: "priprava", review: ["redeni", "prevody"], ramp: "standard" };

/** Kategorie příkladu podle plánu — ověřuje, že se losovalo ze správného fondu. */
const kategorie = (plan: { items: readonly { templateId: string }[] }) =>
  plan.items.map((item) => categoryOf(item.templateId));

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
  it("opakování chyb předloží tentýž výpočet, ale s jinými čísly", () => {
    const original = planLesson("puvodni");
    const wrong = [original.items[1], original.items[4]];
    const repeat = planFromItems("opakovani", wrong);

    // Šablona i obtížnost sedí, semínko je nové.
    expect(repeat.items.map((item) => item.templateId)).toEqual(wrong.map((item) => item.templateId));
    expect(repeat.items.map((item) => item.difficulty)).toEqual(wrong.map((item) => item.difficulty));

    const before = lessonExercise(original, 1);
    const after = lessonExercise(repeat, 0);
    expect(after.templateId).toBe(before.templateId);
    // Zapamatovat si výsledek nestačí: čísla jsou jiná.
    expect(after.vars).not.toEqual(before.vars);
    // Bez bonusu za lekci bez chyby — jediný příklad by vynesl skoro jako celá lekce.
    expect(repeat.kind).toBe("review");
    expect(original.kind).toBeUndefined();
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

describe("denní lekce podle programu", () => {
  it("má pět příkladů ze stupně a dvě opakování", () => {
    expect(DAILY_STAGE_ITEMS + DAILY_REVIEW_ITEMS).toBe(LESSON_LENGTH);
    expect(REVIEW_SLOTS).toHaveLength(DAILY_REVIEW_ITEMS);

    const plan = planDailyLesson("den", DENNI);
    const vestupni = new Set(stageById("priprava").categories);
    const opakovaci = kategorie(plan).filter((_, index) => REVIEW_SLOTS.includes(index));
    const stupnove = kategorie(plan).filter((_, index) => !REVIEW_SLOTS.includes(index));

    expect(plan.items).toHaveLength(LESSON_LENGTH);
    expect(stupnove).toHaveLength(DAILY_STAGE_ITEMS);
    expect(stupnove.every((category) => vestupni.has(category))).toBe(true);
    expect(opakovaci.every((category) => DENNI.review.includes(category))).toBe(true);
  });

  /** Poslední příklad si student zapamatuje — musí být z toho, co se učí teď. */
  it("končí příkladem z rozepsaného stupně, ne opakováním", () => {
    expect(REVIEW_SLOTS).not.toContain(LESSON_LENGTH - 1);
    const plan = planDailyLesson("den", DENNI);
    expect(stageById("priprava").categories).toContain(kategorie(plan).at(-1));
  });

  it("obtížnost bere z náběhu v předpisu", () => {
    const plan = planDailyLesson("den", { ...DENNI, ramp: "push" });
    expect(plan.items.map((item) => item.difficulty)).toEqual([...RAMPS.push]);
  });

  it("tentýž identifikátor a předpis dají tutéž lekci", () => {
    expect(planDailyLesson("den", DENNI)).toEqual(planDailyLesson("den", DENNI));
    expect(planDailyLesson("den", { ...DENNI, stage: "ledviny" })).not.toEqual(
      planDailyLesson("den", DENNI),
    );
  });

  it("bez zvládnuté látky naplní všech sedm ze stupně", () => {
    const plan = planDailyLesson("den", { ...DENNI, review: [] });
    const vestupni = new Set(stageById("priprava").categories);
    expect(plan.items).toHaveLength(LESSON_LENGTH);
    expect(kategorie(plan).every((category) => vestupni.has(category))).toBe(true);
  });

  /** Inzulin má jen čtyři šablony na pět míst. */
  it("z malého fondu zopakuje šablonu, ale ne hned vedle sebe a s jiným semínkem", () => {
    const plan = planDailyLesson("den", { stage: "inzulin", review: ["prevody"], ramp: "standard" });
    const ze_stupne = plan.items.filter((_, index) => !REVIEW_SLOTS.includes(index));

    expect(new Set(ze_stupne.map((item) => item.templateId)).size).toBeLessThan(ze_stupne.length);
    for (let index = 1; index < ze_stupne.length; index += 1) {
      expect(ze_stupne[index].templateId).not.toBe(ze_stupne[index - 1].templateId);
    }
    expect(new Set(plan.items.map((item) => item.seed)).size).toBe(LESSON_LENGTH);
  });
});

describe("chyby v denní lekci", () => {
  /** Šablona z rozepsaného stupně: přesně ten případ, kdy ji los mohl minout. */
  const zeStupne = productionTemplates().find((template) => template.category === "rekonstituce")!.id;
  const odjinud = productionTemplates().find((template) => template.category === "zaklad")!.id;

  it("obsadí místa opakování tímtéž typem v téže obtížnosti", () => {
    const plan = planDailyLesson("den", {
      ...DENNI,
      mistakes: [
        { templateId: zeStupne, difficulty: 3 },
        { templateId: odjinud, difficulty: 1 },
      ],
    });

    expect(REVIEW_SLOTS.map((slot) => plan.items[slot])).toMatchObject([
      { templateId: zeStupne, difficulty: 3, origin: "mistake" },
      { templateId: odjinud, difficulty: 1, origin: "mistake" },
    ]);
    // Typ, který přišel jako chyba, se ze stupně podruhé nelosuje.
    expect(plan.items.filter((item) => item.templateId === zeStupne)).toHaveLength(1);
    expect(plan.items.filter((item) => item.origin === "mistake")).toHaveLength(2);
  });

  it("jedna chyba nechá druhé místo zvládnuté látce", () => {
    const plan = planDailyLesson("den", { ...DENNI, mistakes: [{ templateId: odjinud, difficulty: 2 }] });
    const [prvni, druhe] = REVIEW_SLOTS.map((slot) => plan.items[slot]);

    expect(prvni).toMatchObject({ templateId: odjinud, origin: "mistake" });
    expect(druhe.origin).toBeUndefined();
    expect(DENNI.review).toContain(categoryOf(druhe.templateId));
  });

  it("dostane se do lekce i bez zvládnuté látky", () => {
    const plan = planDailyLesson("den", {
      ...DENNI,
      review: [],
      mistakes: [{ templateId: odjinud, difficulty: 2 }],
    });
    const vestupni = new Set(stageById("priprava").categories);

    expect(plan.items).toHaveLength(LESSON_LENGTH);
    expect(plan.items[REVIEW_SLOTS[0]]).toMatchObject({ templateId: odjinud, origin: "mistake" });
    expect(kategorie(plan).filter((category) => !vestupni.has(category))).toEqual(["zaklad"]);
  });

  it("šablonu, která z produkce vypadla, přeskočí", () => {
    const plan = planDailyLesson("den", { ...DENNI, mistakes: [{ templateId: "ZZ9", difficulty: 1 }] });
    expect(plan).toEqual(planDailyLesson("den", DENNI));
  });
});

describe("který plán se hraje", () => {
  it("uložený plán má přednost před předpisem i identifikátorem", () => {
    const ulozeny = planFromItems("x", [{ templateId: "A1", difficulty: 1 }]);
    expect(resolvePlan({ lessonId: "x", plan: ulozeny, spec: DENNI })).toBe(ulozeny);
  });

  it("předpis má přednost před holým identifikátorem", () => {
    expect(resolvePlan({ lessonId: "den", spec: DENNI })).toEqual(planDailyLesson("den", DENNI));
  });

  /**
   * Souboj stojí na tom, že oba hráči sestaví z téhož identifikátoru tutéž
   * lekci. Sdílená lekce proto nesmí sáhnout na stav uživatele.
   */
  it("holý identifikátor dá oběma hráčům souboje tutéž lekci", () => {
    expect(resolvePlan({ lessonId: "souboj" })).toEqual(planLesson("souboj"));
  });
});

describe("vrácený příklad", () => {
  it("dostane jiná čísla než ten, na kterém student pohořel", () => {
    const plan = planLesson("lekce");
    const prvni = lessonExercise(plan, 0);
    const podruhe = lessonExercise(plan, 0, 1);
    const potreti = lessonExercise(plan, 0, 2);

    expect(podruhe.templateId).toBe(prvni.templateId);
    expect(podruhe.difficulty).toBe(prvni.difficulty);
    expect(podruhe.vars).not.toEqual(prvni.vars);
    expect(potreti.vars).not.toEqual(podruhe.vars);
  });

  it("tentýž pokus dá pokaždé totéž — jinak by se lekce po návratu rozpadla", () => {
    const plan = planLesson("lekce");
    expect(lessonExercise(plan, 3, 2).vars).toEqual(lessonExercise(plan, 3, 2).vars);
  });
});
