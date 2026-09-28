import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it, vi } from "vitest";

/**
 * Přechod na třetí verzi schématu.
 *
 * Události uložené starší verzí uid nemají. Kdyby ho migrace nedoplnila,
 * odeslala by se na server událost bez identity a server by ji odmítl.
 * Test proto založí databázi přesně tak, jak vypadala ve verzi 2, a teprve
 * pak ji otevře aplikací.
 */
describe("migrace databáze", () => {
  it("doplní uid událostem uloženým starší verzí", async () => {
    await Dexie.delete("miligram");

    const stara = new Dexie("miligram");
    stara.version(2).stores({
      profile: "id",
      answers: "++id, lessonId, templateId, correct, answeredAt",
      lessons: "++id, lessonId, finishedAt",
      outbox: "++id, type, syncedAt",
    });
    await stara.open();
    await stara.table("outbox").bulkAdd([
      { type: "lessonFinished", payload: { lessonId: "abc", answers: [] }, createdAt: "2026-09-01T10:00:00.000Z" },
      {
        type: "pillsSpent",
        payload: { amount: 15, reason: "hint" },
        createdAt: "2026-09-01T10:05:00.000Z",
        syncedAt: "2026-09-01T10:06:00.000Z",
      },
    ]);
    stara.close();

    vi.resetModules();
    const { db } = await import("../db");
    const udalosti = await db().outbox.orderBy("id").toArray();

    expect(udalosti).toHaveLength(2);
    for (const udalost of udalosti) {
      expect(udalost.uid).toMatch(/^[0-9a-f-]{32,36}$/);
    }
    expect(udalosti[0].uid).not.toBe(udalosti[1].uid);
    // Už odeslaná událost zůstává odeslaná — nová identita ji nepošle znovu.
    expect(udalosti[1].syncedAt).toBe("2026-09-01T10:06:00.000Z");
  });
});

describe("migrace na pátou verzi", () => {
  it("starým odpovědím dopočítá první pokus a rozehrané lekci pokusy", async () => {
    await Dexie.delete("miligram");

    const stara = new Dexie("miligram");
    stara.version(4).stores({
      profile: "id",
      answers: "++id, lessonId, templateId, correct, answeredAt",
      lessons: "++id, lessonId, finishedAt",
      outbox: "++id, &uid, type, syncedAt",
      progress: "id",
    });
    await stara.open();
    await stara.table("answers").bulkAdd([
      {
        lessonId: "l",
        index: 0,
        templateId: "A1",
        seed: "l:0",
        difficulty: 1,
        correct: true,
        hinted: false,
        repaired: false,
        answeredAt: "2026-09-01T10:00:00.000Z",
      },
      {
        lessonId: "l",
        index: 1,
        templateId: "A2",
        seed: "l:1",
        difficulty: 1,
        correct: false,
        hinted: false,
        repaired: true,
        answeredAt: "2026-09-01T10:01:00.000Z",
      },
    ]);
    await stara.table("progress").put({
      id: 1,
      lessonId: "m",
      answers: [
        { templateId: "A1", seed: "m:0", difficulty: 1, correct: true, hinted: false, repaired: false },
        { templateId: "A2", seed: "m:1", difficulty: 2, correct: false, hinted: true, repaired: false },
      ],
      startedAt: "2026-09-02T10:00:00.000Z",
      updatedAt: "2026-09-02T10:05:00.000Z",
    });
    stara.close();

    vi.resetModules();
    const { db } = await import("../db");
    const odpovedi = await db().answers.orderBy("id").toArray();

    // Starý záznam první pokus nerozlišoval: jak dopadl, tak dopadl.
    expect(odpovedi[0]).toMatchObject({ correct: true, firstTry: true, attempts: 1 });
    expect(odpovedi[1]).toMatchObject({ correct: false, firstTry: false, attempts: 1 });

    const rozehrana = await db().progress.get(1);
    expect(rozehrana?.attempts.map((one) => [one.seed, one.index, one.correct])).toEqual([
      ["m:0", 0, true],
      ["m:1", 1, false],
    ]);
  });
});

describe("migrace na osmou verzi — peněženka na serveru", () => {
  it("odloží zůstatek jako počáteční stav a staré útraty už neposílá", async () => {
    await Dexie.delete("miligram");

    const stara = new Dexie("miligram");
    stara.version(7).stores({
      profile: "id",
      answers: "++id, lessonId, templateId, correct, answeredAt",
      lessons: "++id, lessonId, finishedAt",
      outbox: "++id, &uid, type, syncedAt",
      progress: "id",
      gifts: "id, receivedAt",
      duelRewards: "id",
      badges: "id",
    });
    await stara.open();
    await stara.table("profile").put({
      id: 1,
      pills: 85,
      xp: 400,
      streakDays: 6,
      lastLessonDay: "2026-09-20",
      streakFreezes: 1,
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-20T10:00:00.000Z",
    });
    await stara.table("outbox").add({
      uid: "stara-utrata",
      type: "pillsSpent",
      payload: { amount: 15, reason: "hint" },
      createdAt: "2026-09-20T10:05:00.000Z",
    });
    stara.close();

    vi.resetModules();
    const { db, readProfile } = await import("../db");
    expect((await readProfile()).opening).toEqual({ pills: 85, freezes: 1 });
    const utrata = await db().outbox.where("uid").equals("stara-utrata").first();
    expect(utrata?.syncedAt).toBeDefined();
  });
});
