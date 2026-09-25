import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearProgress, db, readProgress, recordAnswer, recordLesson } from "../db";
import { solvedToday } from "../today";

const pokus = (seed: string, correct = true, index = 0) => ({
  templateId: "A1",
  seed,
  difficulty: 1,
  index,
  correct,
  hinted: false,
});

/** Odpověď tak, jak ji zapisuje dokončená lekce — bez pořadí pokusů. */
const odpoved = (seed: string, correct = true) => ({
  templateId: "A1",
  seed,
  difficulty: 1,
  correct,
  hinted: false,
});

beforeEach(async () => {
  const database = db();
  await Promise.all([
    database.profile.clear(),
    database.answers.clear(),
    database.lessons.clear(),
    database.outbox.clear(),
    database.progress.clear(),
  ]);
});

describe("rozehraná lekce", () => {
  /**
   * Důvod celé té tabulky: kdo vystoupí z tramvaje po třetím příkladu,
   * nesmí přijít o odvedenou práci.
   */
  it("tři vyřešené se počítají do dnešního cíle, i když lekce nedoběhla", async () => {
    for (const [index, seed] of ["l:0", "l:1", "l:2"].entries()) {
      await recordAnswer("l", pokus(seed, true, index));
    }

    expect(await solvedToday()).toBe(3);
    expect((await readProgress())?.attempts).toHaveLength(3);
  });

  it("chyba se do dnešního cíle nepočítá, dokud se příklad nespočítá", async () => {
    await recordAnswer("l", pokus("l:0", false));
    expect(await solvedToday()).toBe(0);

    // Tentýž příklad podruhé: záznam se doplní, nezaloží se druhý.
    await recordAnswer("l", pokus("l:0", true));
    expect(await solvedToday()).toBe(1);
    expect(await db().answers.count()).toBe(1);

    const answer = (await db().answers.toArray())[0];
    expect(answer).toMatchObject({ correct: true, firstTry: false, attempts: 2 });
  });

  it("drží pořadí pokusů a plán, aby se dalo navázat", async () => {
    await recordAnswer("l", pokus("l:0", true, 0), { plan: { id: "l", items: [] }, duelId: "souboj" });
    await recordAnswer("l", pokus("l:1", false, 1));

    const progress = await readProgress();
    expect(progress).toMatchObject({ lessonId: "l", duelId: "souboj" });
    expect(progress?.attempts.map((a) => a.correct)).toEqual([true, false]);
    expect(await db().answers.orderBy("id").toArray()).toMatchObject([{ index: 0 }, { index: 1 }]);
  });

  it("jiná lekce rozehranou nahradí, odpovědi té první zůstanou", async () => {
    await recordAnswer("prvni", pokus("prvni:0"));
    await recordAnswer("druha", pokus("druha:0"));

    expect(await readProgress()).toMatchObject({ lessonId: "druha" });
    expect((await readProgress())?.attempts).toHaveLength(1);
    expect(await db().answers.count()).toBe(2);
  });

  it("dokončená lekce rozehranou uklidí a odpovědi nezaloží podruhé", async () => {
    const answers = ["l:0", "l:1"].map((seed) => odpoved(seed));
    for (const [index, seed] of ["l:0", "l:1"].entries()) {
      await recordAnswer("l", pokus(seed, true, index));
    }

    await recordLesson({
      lessonId: "l",
      answers,
      reward: { xp: 40, pills: 4, correct: 2, count: 2, flawless: true },
    });

    expect(await readProgress()).toBeUndefined();
    expect(await db().answers.count()).toBe(2);
    expect(await solvedToday()).toBe(2);
  });

  it("lekce zapsaná naráz odpovědi uloží — na tom stojí obnova i testy", async () => {
    await recordLesson({
      lessonId: "l",
      answers: [odpoved("l:0")],
      reward: { xp: 30, pills: 12, correct: 1, count: 1, flawless: true },
    });

    expect(await db().answers.count()).toBe(1);
  });

  it("odložení rozehrané lekce nesmaže, co už je zodpovězené", async () => {
    await recordAnswer("l", pokus("l:0"));
    await clearProgress();

    expect(await readProgress()).toBeUndefined();
    expect(await solvedToday()).toBe(1);
  });

  it("správná odpověď napoprvé připíše pastilky hned, XP až lekce", async () => {
    await recordAnswer("l", pokus("l:0"));

    const profile = await db().profile.get(1);
    expect(profile?.xp ?? 0).toBe(0);
    expect(profile?.pills).toBe(2);
  });

  it("opakování ani vzdání pastilky nepřipíše — odměna je za první pokus", async () => {
    await recordAnswer("l", pokus("l:0", false));
    await recordAnswer("l", pokus("l:0", true));
    await recordAnswer("l", { ...pokus("l:1", true, 1), gaveUp: true });

    expect((await db().profile.get(1))?.pills ?? 0).toBe(0);
  });

  it("dokončení lekce přičte jen to, co odpovědi ještě nepřipsaly", async () => {
    await recordAnswer("l", pokus("l:0", true, 0));
    await recordAnswer("l", pokus("l:1", true, 1));

    const profile = await recordLesson({
      lessonId: "l",
      answers: [odpoved("l:0"), odpoved("l:1")],
      reward: { xp: 40, pills: 14, correct: 2, count: 2, flawless: true },
    });
    expect(profile.pills).toBe(14);
    expect(profile.xp).toBe(40);
  });

  it("lekce rozehraná před připisováním po odpovědích se doplatí celá", async () => {
    await db().answers.add({
      lessonId: "stara",
      index: 0,
      templateId: "A1",
      seed: "stara:0",
      difficulty: 1,
      correct: true,
      firstTry: true,
      attempts: 1,
      hinted: false,
      answeredAt: new Date().toISOString(),
    });

    const profile = await recordLesson({
      lessonId: "stara",
      answers: [odpoved("stara:0")],
      reward: { xp: 30, pills: 12, correct: 1, count: 1, flawless: true },
    });
    expect(profile.pills).toBe(12);
  });
});
