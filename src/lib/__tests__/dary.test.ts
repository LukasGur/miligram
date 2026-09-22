import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_STREAK_FREEZES } from "@/core/economy";
import { claimGift, db, readProfile, receivedGifts } from "../db";

const dar = (id: string, fromHandle = "honza") => ({ id, fromHandle });

beforeEach(async () => {
  const database = db();
  await Promise.all([database.profile.clear(), database.gifts.clear()]);
});

describe("dar od kamaráda", () => {
  it("připíše ochranu série, ale nestrhne prášky — zaplatil je odesílatel", async () => {
    await db().profile.put({ ...(await readProfile()), id: 1, pills: 12, streakFreezes: 0 });

    expect(await claimGift(dar("g1"), MAX_STREAK_FREEZES)).toBe("ok");

    const profile = await readProfile();
    expect(profile.streakFreezes).toBe(1);
    expect(profile.pills).toBe(12);
  });

  /** Potvrzení na server se nemusí povést; dar pak přijde znovu. */
  it("tentýž dar se nepřipíše dvakrát", async () => {
    expect(await claimGift(dar("g1"), MAX_STREAK_FREEZES)).toBe("ok");
    expect(await claimGift(dar("g1"), MAX_STREAK_FREEZES)).toBe("known");
    expect((await readProfile()).streakFreezes).toBe(1);
  });

  it("s plnou zásobou počká, místo aby se ztratil", async () => {
    await db().profile.put({ ...(await readProfile()), id: 1, streakFreezes: MAX_STREAK_FREEZES });

    expect(await claimGift(dar("g1"), MAX_STREAK_FREEZES)).toBe("full");
    // Nezapsaný dar se na serveru neoznačí za vyzvednutý, takže dorazí zas.
    expect(await receivedGifts()).toEqual([]);
  });

  it("pamatuje si, od koho dar přišel, a řadí od nejnovějšího", async () => {
    await claimGift(dar("g1", "honza"), MAX_STREAK_FREEZES, new Date("2026-09-20T10:00:00Z"));
    await db().profile.put({ ...(await readProfile()), id: 1, streakFreezes: 0 });
    await claimGift(dar("g2", "petra"), MAX_STREAK_FREEZES, new Date("2026-09-21T10:00:00Z"));

    expect((await receivedGifts()).map((one) => one.fromHandle)).toEqual(["petra", "honza"]);
  });
});
