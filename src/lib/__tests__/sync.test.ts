import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, recordLesson, spendPills } from "../db";
import { syncOutbox, type LessonEventRow, type SyncGateway } from "../sync";

const LESSON = {
  lessonId: "abc",
  answers: [{ templateId: "A1", seed: "abc:0", difficulty: 1, correct: true, hinted: false }],
  reward: { xp: 10, pills: 2, correct: 1, count: 1, flawless: true },
};

function fakeGateway() {
  const received: LessonEventRow[][] = [];
  const gateway: SyncGateway = {
    async pushLessonEvents(rows) {
      received.push([...rows]);
    },
  };
  return { gateway, received };
}

function failingGateway(): SyncGateway {
  return {
    async pushLessonEvents() {
      throw new Error("síť je pryč");
    },
  };
}

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

describe("odeslání fronty", () => {
  it("pošle čekající lekce a označí je za odeslané", async () => {
    await recordLesson(LESSON);
    const { gateway, received } = fakeGateway();

    expect(await syncOutbox(gateway)).toEqual({ sent: 1, pending: 0 });
    expect(received[0][0]).toMatchObject({ lesson_id: "abc" });
    expect(received[0][0].answers).toHaveLength(1);
  });

  it("podruhé už nemá co poslat", async () => {
    await recordLesson(LESSON);
    const { gateway, received } = fakeGateway();
    await syncOutbox(gateway);

    expect(await syncOutbox(gateway)).toEqual({ sent: 0, pending: 0 });
    expect(received).toHaveLength(1);
  });

  it("po selhání zůstane událost ve frontě", async () => {
    await recordLesson(LESSON);
    await expect(syncOutbox(failingGateway())).rejects.toThrow(/síť/);

    const waiting = await db().outbox.filter((event) => event.syncedAt === undefined).count();
    expect(waiting).toBe(1);
  });

  it("útrata prášků se neodesílá — zůstatek je věcí zařízení", async () => {
    await recordLesson({ ...LESSON, reward: { ...LESSON.reward, pills: 20 } });
    await spendPills(15, "hint");
    const { gateway, received } = fakeGateway();

    const result = await syncOutbox(gateway);
    expect(result.sent).toBe(1);
    // Událost o útratě ve frontě zůstane, ale nikam se neposílá.
    expect(result.pending).toBe(1);
    expect(received.flat()).toHaveLength(1);
  });

  it("posílá po dávkách, ne všechno naráz", async () => {
    for (let i = 0; i < 30; i += 1) {
      await recordLesson({ ...LESSON, lessonId: `l${i}` });
    }
    const { gateway, received } = fakeGateway();

    expect(await syncOutbox(gateway)).toEqual({ sent: 30, pending: 0 });
    expect(received.map((batch) => batch.length)).toEqual([25, 5]);
  });

  it("každá událost nese vlastní identifikátor kvůli opakovanému odeslání", async () => {
    await recordLesson(LESSON);
    await recordLesson({ ...LESSON, lessonId: "def" });
    const { gateway, received } = fakeGateway();
    await syncOutbox(gateway);

    const ids = received.flat().map((row) => row.client_event_id);
    expect(new Set(ids).size).toBe(2);
  });
});
