import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { currentStreak, REPAIR_COST, repairOffer } from "@/core/economy";
import { db, PROFILE_ID, readProfile, recordLesson, type WalletPayload } from "../db";
import { repairStreak } from "../repair";

/** Místní poledne daného dne — série se počítá podle kalendáře uživatele. */
function poledne(den: string): Date {
  const [y, m, d] = den.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

const LEKCE = (id: string) => ({
  lessonId: id,
  answers: [{ templateId: "A1", seed: `${id}:0`, difficulty: 1, correct: true, hinted: false }],
  reward: { xp: 10, pills: 2, correct: 1, count: 1, flawless: true },
});

async function tydenDo(konec: number) {
  for (let den = konec - 6; den <= konec; den += 1) {
    await recordLesson(LEKCE(`l${den}`), poledne(`2026-09-${String(den).padStart(2, "0")}`));
  }
}

async function nabidka(today: string) {
  const profile = await readProfile();
  const lessons = await db().lessons.toArray();
  return repairOffer({
    lessonDays: lessons.map((lesson) => {
      const d = new Date(lesson.finishedAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
    coveredDays: profile.coveredDays ?? [],
    freezes: profile.streakFreezes ?? 0,
    lastRepair: profile.lastRepair ?? null,
    today,
  });
}

beforeEach(async () => {
  const database = db();
  await database.transaction("rw", database.tables, async () => {
    await Promise.all(database.tables.map((table) => table.clear()));
  });
});

describe("obnovení série v telefonu", () => {
  it("ještě nehrál: série dojede ke včerejšku a stojí 200", async () => {
    await tydenDo(10);
    await db().profile.update(PROFILE_ID, { pills: 250 });
    const offer = (await nabidka("2026-09-12"))!;
    expect(offer.missing).toEqual(["2026-09-11"]);

    expect(await repairStreak(offer, poledne("2026-09-12"))).toBe("ok");
    const profile = await readProfile();
    expect(profile.pills).toBe(250 - REPAIR_COST);
    expect(
      currentStreak(
        { days: profile.streakDays, lastDay: profile.lastLessonDay, freezes: 0, covered: profile.coveredDays },
        "2026-09-12",
      ),
    ).toBe(7);

    // Dnešní lekce sérii prodlouží.
    const po = await recordLesson(LEKCE("dnes"), poledne("2026-09-12"));
    expect(po.streakDays).toBe(8);

    const pohyby = (await db().outbox.where("type").equals("wallet").toArray()).map((e) => e.payload as WalletPayload);
    expect(pohyby).toContainEqual({ kind: "repair", pills: -REPAIR_COST, freezes: 0, reason: "streakRepair", day: "2026-09-11" });
  });

  it("už znovu hrál: obnovení spojí starou řadu s novou", async () => {
    await tydenDo(10);
    await recordLesson(LEKCE("po"), poledne("2026-09-12"));
    expect((await readProfile()).streakDays).toBe(1);
    await db().profile.update(PROFILE_ID, { pills: 200 });

    const offer = (await nabidka("2026-09-12"))!;
    expect(await repairStreak(offer, poledne("2026-09-12"))).toBe("ok");
    expect((await readProfile()).streakDays).toBe(8);
    // A podruhé se už nenabízí.
    expect(await nabidka("2026-09-12")).toBeNull();
  });

  it("bez pastilek neprojde a nic nezmění", async () => {
    await tydenDo(10);
    await db().profile.update(PROFILE_ID, { pills: 50 });
    const offer = (await nabidka("2026-09-12"))!;
    expect(await repairStreak(offer)).toBe("poor");
    expect((await readProfile()).pills).toBe(50);
    expect((await readProfile()).coveredDays ?? []).toEqual([]);
  });
});
