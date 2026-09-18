import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearProgress, db, readProgress, recordAnswer, recordLesson } from "../db";
import { answeredToday } from "../stats";

const odpoved = (seed: string, correct = true) => ({
  templateId: "A1",
  seed,
  difficulty: 1,
  correct,
  hinted: false,
  repaired: false,
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
  it("tři odpovědi se počítají do dnešního cíle, i když lekce nedoběhla", async () => {
    for (const seed of ["l:0", "l:1", "l:2"]) await recordAnswer("l", odpoved(seed));

    expect(await answeredToday()).toBe(3);
    expect((await readProgress())?.answers).toHaveLength(3);
  });

  it("drží pořadí a plán, aby se dalo navázat", async () => {
    await recordAnswer("l", odpoved("l:0"), { plan: { id: "l", items: [] }, duelId: "souboj" });
    await recordAnswer("l", odpoved("l:1", false));

    const progress = await readProgress();
    expect(progress).toMatchObject({ lessonId: "l", duelId: "souboj" });
    expect(progress?.answers.map((a) => a.correct)).toEqual([true, false]);
    expect(await db().answers.orderBy("id").toArray()).toMatchObject([{ index: 0 }, { index: 1 }]);
  });

  it("jiná lekce rozehranou nahradí, odpovědi té první zůstanou", async () => {
    await recordAnswer("prvni", odpoved("prvni:0"));
    await recordAnswer("druha", odpoved("druha:0"));

    expect(await readProgress()).toMatchObject({ lessonId: "druha" });
    expect((await readProgress())?.answers).toHaveLength(1);
    expect(await db().answers.count()).toBe(2);
  });

  it("dokončená lekce rozehranou uklidí a odpovědi nezaloží podruhé", async () => {
    const answers = ["l:0", "l:1"].map((seed) => odpoved(seed));
    for (const answer of answers) await recordAnswer("l", answer);

    await recordLesson({
      lessonId: "l",
      answers,
      reward: { xp: 40, pills: 4, correct: 2, count: 2, flawless: true },
    });

    expect(await readProgress()).toBeUndefined();
    expect(await db().answers.count()).toBe(2);
    expect(await answeredToday()).toBe(2);
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
    await recordAnswer("l", odpoved("l:0"));
    await clearProgress();

    expect(await readProgress()).toBeUndefined();
    expect(await answeredToday()).toBe(1);
  });

  it("odpověď sama o sobě nepřipisuje XP ani prášky — odměna patří lekci", async () => {
    await recordAnswer("l", odpoved("l:0"));

    const profile = await db().profile.get(1);
    expect(profile?.xp ?? 0).toBe(0);
    expect(profile?.pills ?? 0).toBe(0);
  });
});
