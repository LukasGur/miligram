import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, recordLesson, spendPills } from "../db";
import { syncOutbox, type LessonEventRow, type SyncGateway, type WalletEventRow } from "../sync";

const LESSON = {
  lessonId: "abc",
  answers: [{ templateId: "A1", seed: "abc:0", difficulty: 1, correct: true, hinted: false, repaired: false }],
  reward: { xp: 10, pills: 2, correct: 1, count: 1, flawless: true },
};

function fakeGateway() {
  const received: LessonEventRow[][] = [];
  const wallet: WalletEventRow[] = [];
  const order: string[] = [];
  const gateway: SyncGateway = {
    async pushLessonEvents(rows) {
      order.push("lessons");
      received.push([...rows]);
    },
    async pushWalletEvents(rows) {
      order.push("wallet");
      wallet.push(...rows);
    },
  };
  return { gateway, received, wallet, order };
}

function failingGateway(): SyncGateway {
  return {
    async pushLessonEvents() {
      throw new Error("síť je pryč");
    },
    async pushWalletEvents() {
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

    // Lekce a pohyb v peněžence (2 pastilky za ni).
    expect(await syncOutbox(gateway)).toEqual({ sent: 2, pending: 0 });
    expect(received[0][0]).toMatchObject({ lesson_id: "abc", kind: "lesson" });
    expect(received[0][0].answers).toHaveLength(1);
  });

  it("opakování chyb jde na server označené, ať mu nepřičte bonus", async () => {
    await recordLesson({ ...LESSON, kind: "review" });
    const { gateway, received } = fakeGateway();

    await syncOutbox(gateway);
    expect(received[0][0]).toMatchObject({ kind: "review" });
  });

  it("událost z doby před druhy lekcí se pošle jako lekce", async () => {
    await db().outbox.add({
      uid: "stara",
      type: "lessonFinished",
      payload: { lessonId: "stara", answers: LESSON.answers },
      createdAt: new Date().toISOString(),
    });
    const { gateway, received } = fakeGateway();

    await syncOutbox(gateway);
    expect(received[0][0]).toMatchObject({ kind: "lesson" });
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
    expect(waiting).toBe(2);
  });

  it("útrata jde na server jako pohyb v peněžence, a to před lekcemi", async () => {
    await recordLesson({ ...LESSON, reward: { ...LESSON.reward, pills: 20 } });
    await spendPills(15, "hint");
    const { gateway, received, wallet, order } = fakeGateway();

    expect(await syncOutbox(gateway)).toEqual({ sent: 3, pending: 0 });
    expect(received.flat()).toHaveLength(1);
    expect(wallet.map((row) => [row.kind, row.pills, row.reason])).toEqual([
      ["earn", 20, "lesson"],
      ["spend", -15, "hint"],
    ]);
    expect(order).toEqual(["wallet", "lessons"]);
  });

  it("posílá po dávkách, ne všechno naráz", async () => {
    for (let i = 0; i < 30; i += 1) {
      await recordLesson({ ...LESSON, lessonId: `l${i}` });
    }
    const { gateway, received } = fakeGateway();

    expect(await syncOutbox(gateway)).toEqual({ sent: 60, pending: 0 });
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
