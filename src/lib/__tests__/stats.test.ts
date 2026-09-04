import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import "@/core/templates";
import { db, recordLesson } from "../db";
import { mistakesToRepeat, overview } from "../stats";

const answer = (templateId: string, seed: string, correct: boolean) => ({
  templateId,
  seed,
  difficulty: 1,
  correct,
  hinted: false,
  repaired: false,
});

beforeEach(async () => {
  const database = db();
  await database.transaction(
    "rw",
    database.profile,
    database.answers,
    database.lessons,
    database.outbox,
    async () => {
      await Promise.all([
        database.profile.clear(),
        database.answers.clear(),
        database.lessons.clear(),
        database.outbox.clear(),
      ]);
    },
  );
});

describe("přehled", () => {
  it("prázdná historie nemá úspěšnost nula, ale žádnou", async () => {
    const stats = await overview();
    expect(stats).toMatchObject({ lessons: 0, answered: 0, correct: 0, rate: null });
    expect(stats.categories).toEqual([]);
  });

  it("řadí kategorie od nejslabší", async () => {
    await recordLesson({
      lessonId: "l1",
      answers: [
        answer("A1", "l1:0", true),
        answer("A2", "l1:1", true),
        answer("H1", "l1:2", false),
        answer("H2", "l1:3", false),
      ],
      reward: { xp: 20, pills: 4, correct: 2, count: 4, flawless: false },
    });

    const stats = await overview();
    expect(stats.answered).toBe(4);
    expect(stats.rate).toBe(0.5);
    expect(stats.categories[0]).toMatchObject({ category: "prevody", rate: 0 });
    expect(stats.categories.at(-1)).toMatchObject({ category: "zaklad", rate: 1 });
  });

  it("historie po smazané šabloně statistiku nepoloží", async () => {
    await db().answers.add({ ...answer("ZZ9", "x", false), lessonId: "l", index: 0, answeredAt: "" });
    await expect(overview()).resolves.toMatchObject({ answered: 1 });
  });
});

describe("chyby k opakování", () => {
  it("vrací jen ty, které zůstaly chybné", async () => {
    await recordLesson({
      lessonId: "l1",
      answers: [answer("A1", "s1", false), answer("A2", "s2", false)],
      reward: { xp: 0, pills: 0, correct: 0, count: 2, flawless: false },
    });
    // Tentýž příklad podruhé, tentokrát správně.
    await recordLesson({
      lessonId: "l2",
      answers: [answer("A1", "s1", true)],
      reward: { xp: 10, pills: 2, correct: 1, count: 1, flawless: true },
    });

    const mistakes = await mistakesToRepeat(10);
    expect(mistakes).toEqual([{ templateId: "A2", seed: "s2", difficulty: 1 }]);
  });

  it("drží se zadaného počtu", async () => {
    await recordLesson({
      lessonId: "l",
      answers: Array.from({ length: 9 }, (_, i) => answer("A1", `s${i}`, false)),
      reward: { xp: 0, pills: 0, correct: 0, count: 9, flawless: false },
    });
    expect(await mistakesToRepeat(7)).toHaveLength(7);
  });
});
