import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, emptyProfile, recordLesson, spendPills } from "../db";
import { RejectedError, syncOutbox, type LessonEventRow, type SyncGateway, type WalletEventRow } from "../sync";

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
    expect(await syncOutbox(gateway)).toEqual({ sent: 2, pending: 0, rejected: 0 });
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

    expect(await syncOutbox(gateway)).toEqual({ sent: 0, pending: 0, rejected: 0 });
    expect(received).toHaveLength(1);
  });

  it("po selhání zůstane událost ve frontě", async () => {
    await recordLesson(LESSON);
    await expect(syncOutbox(failingGateway())).rejects.toThrow(/síť/);

    const waiting = await db().outbox.filter((event) => event.syncedAt === undefined).count();
    expect(waiting).toBe(2);
  });

  it("odmítnutý pohyb v peněžence nezadrží ostatní ani lekce", async () => {
    await recordLesson({ ...LESSON, reward: { ...LESSON.reward, pills: 20 } });
    await spendPills(15, "hint");
    const wallet: WalletEventRow[] = [];
    const lessons: LessonEventRow[] = [];
    const gateway: SyncGateway = {
      async pushWalletEvents(rows) {
        // Server odmítne útratu (třeba obnovení série po lhůtě); dávka
        // s ní neprojde celá.
        if (rows.some((row) => row.kind === "spend")) throw new RejectedError("check_violation");
        wallet.push(...rows);
      },
      async pushLessonEvents(rows) {
        lessons.push(...rows);
      },
    };

    expect(await syncOutbox(gateway)).toEqual({ sent: 2, pending: 0, rejected: 1 });
    expect(wallet.map((row) => row.kind)).toEqual(["earn"]);
    expect(lessons).toHaveLength(1);

    const odlozene = await db().outbox.filter((event) => event.rejectedAt !== undefined).toArray();
    expect(odlozene.map((event) => (event.payload as { kind: string }).kind)).toEqual(["spend"]);
    // Příště se už neposílá.
    expect(await syncOutbox(gateway)).toEqual({ sent: 0, pending: 0, rejected: 0 });
  });

  it("síťová chyba při posílání po jedné nic neodloží", async () => {
    await recordLesson(LESSON);
    await spendPills(1, "hint");
    let calls = 0;
    const gateway: SyncGateway = {
      async pushWalletEvents() {
        calls += 1;
        if (calls === 1) throw new RejectedError("check_violation");
        throw new Error("síť je pryč");
      },
      async pushLessonEvents() {},
    };

    await expect(syncOutbox(gateway)).rejects.toThrow(/síť/);
    expect(await db().outbox.filter((event) => event.rejectedAt !== undefined).count()).toBe(0);
    expect(await db().outbox.filter((event) => event.syncedAt === undefined).count()).toBe(3);
  });

  it("útrata jde na server jako pohyb v peněžence, a to před lekcemi", async () => {
    await recordLesson({ ...LESSON, reward: { ...LESSON.reward, pills: 20 } });
    await spendPills(15, "hint");
    const { gateway, received, wallet, order } = fakeGateway();

    expect(await syncOutbox(gateway)).toEqual({ sent: 3, pending: 0, rejected: 0 });
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

    expect(await syncOutbox(gateway)).toEqual({ sent: 60, pending: 0, rejected: 0 });
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

describe("odmítnuté obnovení série", () => {
  it("vrátí pokryté dny a sérii přepočítá z historie", async () => {
    const { repairStreak } = await import("../repair");
    const database = db();
    // Série 8 dní do 1. 10., pak 2. a 3. 10. vynechané, 4. 10. hrál znovu.
    const played = ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-04"];
    for (const [index, day] of played.entries()) {
      await database.lessons.add({ lessonId: `l${index}`, count: 7, correct: 7, flawless: true, xp: 30, pills: 24, finishedAt: `${day}T10:00:00` });
    }
    await database.profile.put({ ...emptyProfile(), pills: 500, streakDays: 1, lastLessonDay: "2026-10-04" });

    await repairStreak({ lost: 8, missing: ["2026-10-02", "2026-10-03"], until: "2026-10-04" }, new Date("2026-10-04T12:00:00"));
    expect((await database.profile.get(1))!.streakDays).toBe(9);

    const gateway: SyncGateway = {
      async pushWalletEvents(rows) {
        if (rows.some((row) => row.kind === "repair")) throw new RejectedError("check_violation");
      },
      async pushLessonEvents() {},
    };
    await syncOutbox(gateway);

    const profile = (await database.profile.get(1))!;
    expect(profile.coveredDays ?? []).toEqual([]);
    expect(profile.lastRepair).toBeUndefined();
    expect(profile.streakDays).toBe(1);
  });
});

describe("úklid fronty", () => {
  it("smaže odeslané události starší třiceti dní, čekající nechá", async () => {
    const { pruneOutbox } = await import("../sync");
    const outbox = db().outbox;
    await outbox.add({ uid: "old", type: "wallet", payload: {}, createdAt: "2026-08-01T00:00:00Z", syncedAt: "2026-08-01T00:00:00Z" });
    await outbox.add({ uid: "fresh", type: "wallet", payload: {}, createdAt: "2026-09-30T00:00:00Z", syncedAt: "2026-09-30T00:00:00Z" });
    await outbox.add({ uid: "waiting", type: "wallet", payload: {}, createdAt: "2026-08-01T00:00:00Z" });

    expect(await pruneOutbox(new Date("2026-10-05T00:00:00Z"))).toBe(1);
    expect((await outbox.toArray()).map((event) => event.uid).sort()).toEqual(["fresh", "waiting"]);
  });
});
