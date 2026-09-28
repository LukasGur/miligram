import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { adoptDevice, bindDecision, wipeDevice } from "../account";
import { db, PROFILE_ID, readProfile, recordLesson, reconcileWallet, spendPills, type WalletPayload } from "../db";

const LESSON = {
  lessonId: "abc",
  answers: [{ templateId: "A1", seed: "abc:0", difficulty: 1, correct: true, hinted: false }],
  reward: { xp: 10, pills: 12, correct: 1, count: 1, flawless: true },
};

const zadnaHistorie = async () => false;
const maHistorii = async () => true;
const bezSite = async (): Promise<boolean> => {
  throw new Error("offline");
};

beforeEach(async () => {
  const database = db();
  await database.transaction("rw", database.tables, async () => {
    await Promise.all(database.tables.map((table) => table.clear()));
  });
});

describe("komu patří data v telefonu", () => {
  it("prázdný telefon si vezme kdokoli", async () => {
    expect(await bindDecision("anna", bezSite)).toEqual({ action: "adopt" });
  });

  it("registrace si vezme, co se odehrálo bez účtu", async () => {
    await recordLesson(LESSON);
    expect(await bindDecision("anna", zadnaHistorie)).toEqual({ action: "adopt" });
  });

  it("účet, který už svoje data má, se nejdřív zeptá", async () => {
    await recordLesson(LESSON);
    const decision = await bindDecision("anna", maHistorii);
    expect(decision).toMatchObject({ action: "confirm", reason: "anonymous" });
    expect(decision.action === "confirm" && decision.summary).toMatchObject({ lessons: 1, pills: 12 });
  });

  it("vlastní data se neřeší a server se neptá", async () => {
    await recordLesson(LESSON);
    await adoptDevice("anna");
    expect(await bindDecision("anna", bezSite)).toEqual({ action: "adopt" });
  });

  it("data jiného účtu nepřevezme ani nový účet", async () => {
    await recordLesson(LESSON);
    await adoptDevice("anna");
    expect(await bindDecision("petr", zadnaHistorie)).toMatchObject({ action: "confirm", reason: "otherAccount" });
  });

  it("zařízení z doby před vlastníky pozná majitele podle stažené historie", async () => {
    await recordLesson(LESSON);
    await db().profile.update(PROFILE_ID, { restoredFor: "anna" });
    expect(await bindDecision("anna", bezSite)).toEqual({ action: "adopt" });
    expect(await bindDecision("petr", zadnaHistorie)).toMatchObject({ action: "confirm", reason: "otherAccount" });
  });

  it("bez sítě se o datech bez vlastníka nerozhodne", async () => {
    await recordLesson(LESSON);
    await expect(bindDecision("anna", bezSite)).rejects.toThrow();
  });
});

describe("převzetí a vyčištění", () => {
  it("převzetí pošle starý zůstatek jako počáteční stav, jednou", async () => {
    await db().profile.put({ ...(await readProfile()), pills: 140, streakFreezes: 1, opening: { pills: 140, freezes: 1 } });
    await adoptDevice("anna");
    await adoptDevice("anna");

    const opening = (await db().outbox.where("type").equals("wallet").toArray())
      .map((event) => event.payload as WalletPayload)
      .filter((payload) => payload.kind === "opening");
    expect(opening).toEqual([{ kind: "opening", pills: 140, freezes: 1, reason: "opening" }]);
    expect(await readProfile()).toMatchObject({ ownerId: "anna", pills: 140 });
    expect((await readProfile()).opening).toBeUndefined();
  });

  it("vyčištění smaže všechno a profil založí pro nový účet", async () => {
    await recordLesson(LESSON);
    await wipeDevice("petr");

    const database = db();
    expect(await database.lessons.count()).toBe(0);
    expect(await database.answers.count()).toBe(0);
    expect(await database.outbox.count()).toBe(0);
    expect(await readProfile()).toMatchObject({ ownerId: "petr", pills: 0, xp: 0, streakDays: 0 });
  });

  it("po odhlášení zůstane telefon bez vlastníka", async () => {
    await recordLesson(LESSON);
    await adoptDevice("anna");
    await wipeDevice();
    expect((await readProfile()).ownerId).toBeUndefined();
  });
});

describe("zůstatek podle serveru", () => {
  it("zůstatek = server + co čeká ve frontě", async () => {
    await recordLesson(LESSON);
    await spendPills(5, "hint");
    // Server zatím nezná nic z telefonu, zato 40 z jiného zařízení.
    await reconcileWallet({ pills: 40, freezes: 0, coveredDays: [] });
    expect((await readProfile()).pills).toBe(40 + 12 - 5);
  });

  it("ochrany drží v mezích zásoby", async () => {
    await reconcileWallet({ pills: 0, freezes: 7, coveredDays: [] });
    expect((await readProfile()).streakFreezes).toBe(2);
  });

  it("hlásí nové dny pokryté ochranou", async () => {
    expect(await reconcileWallet({ pills: 0, freezes: 0, coveredDays: ["2026-09-10"] })).toBe(true);
    expect(await reconcileWallet({ pills: 0, freezes: 0, coveredDays: ["2026-09-10"] })).toBe(false);
    expect((await readProfile()).coveredDays).toEqual(["2026-09-10"]);
  });
});
