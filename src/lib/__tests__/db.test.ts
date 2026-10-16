import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { buyStreakFreeze, db, emptyProfile, PROFILE_ID, readProfile, recordLesson, settleProfile, spendPills } from "../db";

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
    expect(answers[1]).toMatchObject({
      templateId: "B1",
      seed: "abc:1",
      correct: false,
      firstTry: false,
      attempts: 1,
      hinted: true,
    });
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
    const events = await db().outbox.where("type").equals("lessonFinished").toArray();
    expect(events).toHaveLength(1);
    expect(events[0].syncedAt).toBeUndefined();
    // Posílá se, co se stalo, ne jaký je stav — XP si server dopočítá sám.
    // Pastilky jdou zvlášť jako pohyb v peněžence.
    expect(events[0].payload).not.toHaveProperty("pills");
    const wallet = await db().outbox.where("type").equals("wallet").toArray();
    expect(wallet.map((event) => event.payload)).toEqual([
      { kind: "earn", pills: LESSON.reward.pills, freezes: 0, reason: "lesson" },
    ]);
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

describe("ochrana o půlnoci", () => {
  /** Série 14 dní do 11. 10. a jedna ochrana koupená 12. 10. večer. */
  async function scenario() {
    await db().profile.put({
      ...emptyProfile(new Date("2026-10-01T10:00:00")),
      pills: 200,
      streakDays: 14,
      lastLessonDay: "2026-10-11",
      streakFreezes: 1,
      settledThrough: "2026-10-11",
    });
  }

  const usedEvents = async () =>
    (await db().outbox.toArray()).filter((event) => (event.payload as { kind?: string }).kind === "freezeUsed");

  it("ráno po vynechaném dni ochrana ubude a jde na server", async () => {
    await scenario();
    await settleProfile(new Date("2026-10-13T08:00:00"));
    const profile = await readProfile();
    expect(profile.streakFreezes).toBe(0);
    expect(profile.coveredDays).toEqual(["2026-10-12"]);
    expect(profile.frozenDays).toEqual(["2026-10-12"]);
    expect(await usedEvents()).toHaveLength(1);
    expect((await usedEvents())[0]).toMatchObject({ uid: "freeze:2026-10-12" });
  });

  it("druhé otevření tentýž den nestrhne nic navíc", async () => {
    await scenario();
    await settleProfile(new Date("2026-10-13T08:00:00"));
    await settleProfile(new Date("2026-10-13T20:00:00"));
    expect((await readProfile()).streakFreezes).toBe(0);
    expect(await usedEvents()).toHaveLength(1);
  });

  it("lekce po pokrytém dni sérii prodlouží, i když telefon půlnoc prospal", async () => {
    await scenario();
    const profile = await recordLesson(LESSON, new Date("2026-10-13T18:00:00"));
    expect(profile).toMatchObject({ streakDays: 15, streakFreezes: 0, lastLessonDay: "2026-10-13" });
    expect(await usedEvents()).toHaveLength(1);
  });

  it("ochrana koupená po spadlé sérii ji nevzkřísí", async () => {
    await db().profile.put({ ...emptyProfile(), pills: 200, streakDays: 5, lastLessonDay: "2026-10-10", settledThrough: "2026-10-10" });
    await settleProfile(new Date("2026-10-12T08:00:00"));
    expect(await buyStreakFreeze(60, 2, new Date("2026-10-12T09:00:00"))).toBe("ok");
    await settleProfile(new Date("2026-10-13T08:00:00"));
    const profile = await db().profile.get(PROFILE_ID);
    expect(profile?.streakFreezes).toBe(1);
    expect(await usedEvents()).toHaveLength(0);
  });
});
