import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import "@/core/templates";
import { db, recordLesson } from "../db";
import { mistakesToRepeat, overview } from "../stats";
import { answeredToday, weekActivity } from "../today";

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

describe("týden na domovské obrazovce", () => {
  it("začíná pondělím, ať je dnes kterýkoli den", async () => {
    // 17. 9. 2026 je čtvrtek
    const week = await weekActivity("2026-09-17");
    expect(week.map((d) => d.day)).toEqual([
      "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17",
      "2026-09-18", "2026-09-19", "2026-09-20",
    ]);
    expect(week.filter((d) => d.today).map((d) => d.day)).toEqual(["2026-09-17"]);
  });

  it("v neděli ukazuje týden, který právě končí, ne ten příští", async () => {
    const week = await weekActivity("2026-09-20");
    expect(week[0].day).toBe("2026-09-14");
    expect(week.at(-1)).toMatchObject({ day: "2026-09-20", today: true, upcoming: false });
  });

  it("v pondělí je dnešek hned první", async () => {
    const week = await weekActivity("2026-09-14");
    expect(week[0]).toMatchObject({ day: "2026-09-14", today: true });
    expect(week.filter((d) => d.upcoming)).toHaveLength(6);
  });

  it("označí dny, ve kterých uživatel dohrál lekci", async () => {
    await recordLesson(
      {
        lessonId: "l",
        answers: [answer("A1", "s", true)],
        reward: { xp: 10, pills: 2, correct: 1, count: 1, flawless: true },
      },
      new Date("2026-09-16T10:00:00"),
    );

    const week = await weekActivity("2026-09-17");
    expect(week.filter((d) => d.active).map((d) => d.day)).toEqual(["2026-09-16"]);
  });

  /**
   * Lekce dohraná krátce po půlnoci. Uložený čas je v UTC, takže ve
   * středoevropském létě padne ještě na předchozí den — den se ale počítá
   * podle kalendáře uživatele, jinak by se po půlnoci vybarvil včerejšek.
   */
  it("lekci po půlnoci započítá dnešku, ne včerejšku", async () => {
    await recordLesson(
      {
        lessonId: "l",
        answers: [answer("A1", "s", true)],
        reward: { xp: 10, pills: 2, correct: 1, count: 1, flawless: true },
      },
      new Date(2026, 8, 17, 0, 30),
    );

    const week = await weekActivity("2026-09-17");
    expect(week.filter((d) => d.active).map((d) => d.day)).toEqual(["2026-09-17"]);
    expect(await answeredToday("2026-09-17")).toBe(1);
  });

  it("dny, které teprve přijdou, nejsou zmeškané", async () => {
    const week = await weekActivity("2026-09-17");
    expect(week.filter((d) => d.upcoming).map((d) => d.day)).toEqual([
      "2026-09-18", "2026-09-19", "2026-09-20",
    ]);
  });
});
