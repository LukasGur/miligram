import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, readProfile, recordLesson, spendPills } from "../db";

const LESSON = {
  lessonId: "abc",
  answers: [
    { templateId: "A1", seed: "abc:0", difficulty: 1, correct: true, hinted: false, repaired: false },
    { templateId: "B1", seed: "abc:1", difficulty: 1, correct: false, hinted: true, repaired: false },
  ],
  reward: { xp: 10, pills: 2, correct: 1, count: 2, flawless: false },
};

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

describe("zápis dokončené lekce", () => {
  it("připíše prášky, XP a založí sérii", async () => {
    const profile = await recordLesson(LESSON, new Date("2026-09-03T18:00:00"));
    expect(profile.pills).toBe(2);
    expect(profile.xp).toBe(10);
    expect(profile.streakDays).toBe(1);
    expect(profile.lastLessonDay).toBe("2026-09-03");
  });

  it("uloží každou odpověď se semínkem, ne zadání", async () => {
    await recordLesson(LESSON);
    const answers = await db().answers.orderBy("id").toArray();
    expect(answers).toHaveLength(2);
    expect(answers[1]).toMatchObject({ templateId: "B1", seed: "abc:1", correct: false, hinted: true, repaired: false });
    // Zadání ani zobrazený text se neukládá — příklad se sestaví ze semínka.
    expect(Object.keys(answers[0])).not.toContain("vars");
  });

  it("druhá lekce v týž den sérii nezvýší, ale prášky připíše", async () => {
    await recordLesson(LESSON, new Date("2026-09-03T09:00:00"));
    const profile = await recordLesson(LESSON, new Date("2026-09-03T20:00:00"));
    expect(profile.streakDays).toBe(1);
    expect(profile.pills).toBe(4);
  });

  it("navazující den sérii prodlouží", async () => {
    await recordLesson(LESSON, new Date("2026-09-03T09:00:00"));
    const profile = await recordLesson(LESSON, new Date("2026-09-04T09:00:00"));
    expect(profile.streakDays).toBe(2);
  });

  it("zapíše událost do fronty k odeslání", async () => {
    await recordLesson(LESSON);
    const events = await db().outbox.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("lessonFinished");
    expect(events[0].syncedAt).toBeUndefined();
    // Posílá se, co se stalo, ne jaký je stav — stav si server dopočítá sám.
    expect(events[0].payload).not.toHaveProperty("pills");
  });
});

describe("útrata prášků", () => {
  it("odečte, když je z čeho", async () => {
    await recordLesson({ ...LESSON, reward: { ...LESSON.reward, pills: 20 } });
    expect(await spendPills(15, "hint")).toBe(true);
    expect((await readProfile()).pills).toBe(5);
  });

  it("neodečte, když prášky nestačí", async () => {
    await recordLesson(LESSON);
    expect(await spendPills(15, "hint")).toBe(false);
    expect((await readProfile()).pills).toBe(2);
    expect(await db().outbox.where("type").equals("pillsSpent").count()).toBe(0);
  });

  it("odmítne nulovou a zápornou částku", async () => {
    await expect(spendPills(0, "hint")).rejects.toThrow(/kladný/);
    await expect(spendPills(-5, "hint")).rejects.toThrow(/kladný/);
  });

  it("prázdný profil má nuly a nespadne", async () => {
    expect(await readProfile()).toMatchObject({ pills: 0, xp: 0, streakDays: 0, lastLessonDay: null });
  });
});
