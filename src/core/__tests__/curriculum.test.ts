import { describe, expect, it } from "vitest";
import {
  MASTERY_MIN_ANSWERS,
  RAMPS,
  STAGES,
  allStandings,
  blockingDependency,
  currentStage,
  masteredStages,
  rampFor,
  reviewCategories,
  stageStanding,
  type Scores,
  type StageId,
} from "../curriculum";
import { CATEGORIES, type Category } from "../types";

/** Součty po kategoriích, jak je počítá vrstva nad databází. */
function scores(entries: Partial<Record<Category, [answered: number, correct: number]>>): Scores {
  return new Map(
    Object.entries(entries).map(([category, [answered, correct]]) => [
      category as Category,
      { answered, correct },
    ]),
  );
}

/** Zvládnutý stupeň: dost odpovědí a dost správných napoprvé. */
function mastered(stage: StageId): Partial<Record<Category, [number, number]>> {
  const stageDef = STAGES.find((one) => one.id === stage);
  if (!stageDef) throw new Error(stage);
  return Object.fromEntries(stageDef.categories.map((category) => [category, [20, 20]]));
}

describe("program", () => {
  it("pokrývá každou kategorii právě jednou", () => {
    const used = STAGES.flatMap((stage) => stage.categories);
    expect(used.slice().sort()).toEqual([...CATEGORIES].sort());
    expect(new Set(used).size).toBe(used.length);
  });

  /** Acykličnost bez grafového algoritmu: závislost míří vždycky dozadu. */
  it("závislost ukazuje jen na dřívější stupeň", () => {
    const order = new Map(STAGES.map((stage, index) => [stage.id, index]));
    for (const stage of STAGES) {
      for (const required of stage.requires) {
        expect(order.get(required)).toBeLessThan(order.get(stage.id) ?? -1);
      }
    }
  });
});

describe("zvládnutí stupně", () => {
  it("chce deset odpovědí a víc než osmdesát procent", () => {
    expect(stageStanding("koncentrace", scores({ redeni: [10, 8] })).mastered).toBe(false);
    expect(stageStanding("koncentrace", scores({ redeni: [10, 9] })).mastered).toBe(true);
    // Devět z devíti je sice sto procent, ale odpovědí je málo.
    expect(stageStanding("koncentrace", scores({ redeni: [9, 9] })).mastered).toBe(false);
  });

  it("sčítá kategorie stupně dohromady, ne po jedné", () => {
    const standing = stageStanding("jednotky", scores({ prevody: [6, 6], zaklad: [6, 5] }));
    expect(standing.answered).toBe(12);
    expect(standing.correct).toBe(11);
    expect(standing.mastered).toBe(true);
  });

  it("bez odpovědí nemá úspěšnost nulu, ale žádnou", () => {
    expect(stageStanding("ledviny", scores({})).rate).toBeNull();
  });

  it("rozepsaný je první nezvládnutý stupeň", () => {
    expect(currentStage(scores({}))).toBe("jednotky");
    expect(currentStage(scores(mastered("jednotky")))).toBe("koncentrace");
  });

  it("kdo zvládl všechno, zůstává na posledním stupni", () => {
    const vsechno = scores(
      Object.fromEntries(CATEGORIES.map((category) => [category, [20, 20]])) as Record<
        Category,
        [number, number]
      >,
    );
    expect(masteredStages(vsechno).size).toBe(STAGES.length);
    expect(currentStage(vsechno)).toBe(STAGES[STAGES.length - 1].id);
  });
});

describe("látka, na které stupeň stojí", () => {
  it("se hlásí, ale nezakazuje — vrací se stav, ne zákaz", () => {
    const blok = blockingDependency("perfuzory", scores({}));
    expect(blok).not.toBeNull();
    expect(blok?.stage).toBe("koncentrace");
    // Žádná funkce nevrací „nesmíš“; spuštění stupně nic neomezuje.
    expect(allStandings(scores({})).every((one) => !one.mastered)).toBe(true);
  });

  it("ukáže tu nejslabší z nesplněných", () => {
    const stav = scores({ ...mastered("jednotky"), redeni: [20, 14], rekonstituce: [20, 4], infuze: [0, 0] });
    expect(blockingDependency("perfuzory", stav)?.stage).toBe("priprava");
  });

  it("u splněné závislosti mlčí", () => {
    const stav = scores({ ...mastered("jednotky"), ...mastered("koncentrace") });
    expect(blockingDependency("inzulin", stav)).toBeNull();
  });
});

describe("opakování", () => {
  it("bere jen zvládnutou látku a řadí od nejslabší", () => {
    const stav = scores({ prevody: [20, 20], zaklad: [20, 17], redeni: [20, 19] });
    expect(reviewCategories(stav, "koncentrace")).toEqual(["zaklad", "prevody"]);
  });

  it("vynechá kategorie rozepsaného stupně", () => {
    const stav = scores({ ...mastered("jednotky"), ...mastered("koncentrace") });
    expect(reviewCategories(stav, "jednotky")).toEqual(["redeni"]);
  });

  it("u nováčka nemá co nabídnout", () => {
    expect(reviewCategories(scores({ prevody: [3, 1] }), "jednotky")).toEqual([]);
  });
});

describe("náběh obtížnosti", () => {
  it("má vždycky sedm položek", () => {
    for (const ramp of Object.values(RAMPS)) expect(ramp).toHaveLength(7);
  });

  it("začátek je mírný, rozjeté učivo standardní, dobrá úspěšnost přitvrdí", () => {
    expect(rampFor(stageStanding("ledviny", scores({})))).toBe("intro");
    expect(rampFor(stageStanding("ledviny", scores({ renalni: [MASTERY_MIN_ANSWERS, 6] })))).toBe("standard");
    expect(rampFor(stageStanding("ledviny", scores({ renalni: [MASTERY_MIN_ANSWERS, 9] })))).toBe("push");
  });

  it("každý náběh končí nejtěžším příkladem", () => {
    for (const ramp of Object.values(RAMPS)) expect(ramp[ramp.length - 1]).toBe(3);
  });
});
