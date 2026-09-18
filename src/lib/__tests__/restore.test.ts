import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, readProfile, recordLesson, PROFILE_ID } from "../db";
import { pullNews, restoreLessons, type RemoteLesson, type RestoreGateway } from "../restore";

function odpoved(correct: boolean, index = 0) {
  return {
    templateId: "A1",
    seed: `abc:${index}`,
    difficulty: 1,
    correct,
    hinted: false,
    repaired: false,
  };
}

/**
 * Čas uložený na serveru. Skládá se z místního poledne, aby test říkal
 * totéž v každém časovém pásmu — den se počítá podle kalendáře uživatele.
 */
function poledne(den: string): string {
  const [year, month, date] = den.split("-").map(Number);
  return new Date(year, month - 1, date, 12, 0, 0).toISOString();
}

/** Lekce na serveru. Sedm správných odpovědí, tedy bezchybná. */
function lekce(lessonId: string, den: string, correct = 7): RemoteLesson {
  return {
    lessonId,
    finishedAt: poledne(den),
    answers: Array.from({ length: 7 }, (_, index) => odpoved(index < correct, index)),
  };
}

function gateway(lessons: readonly RemoteLesson[]): RestoreGateway & { calls: number; since: (string | undefined)[] } {
  const state = {
    calls: 0,
    since: [] as (string | undefined)[],
    async pullLessons(since?: string) {
      state.calls += 1;
      state.since.push(since);
      // Server vrací jen to, co je od zadané hranice novější.
      return since ? lessons.filter((lesson) => lesson.finishedAt >= since) : lessons;
    },
  };
  return state;
}

beforeEach(async () => {
  const database = db();
  await Promise.all([database.profile.clear(), database.answers.clear(), database.lessons.clear(), database.outbox.clear()]);
});

describe("obnova historie", () => {
  it("složí lekce, odpovědi i XP z ničeho", async () => {
    const result = await restoreLessons(gateway([lekce("a", "2026-09-10")]));

    expect(result.added).toBe(1);
    // Sedm správných je 70 XP a k tomu 20 za bezchybnou lekci.
    expect(result.xp).toBe(90);
    expect(await readProfile()).toMatchObject({ xp: 90, streakDays: 1 });
    expect(await db().answers.count()).toBe(7);
  });

  it("prášky se neobnovují — server zná výdělek, ne útratu", async () => {
    await restoreLessons(gateway([lekce("a", "2026-09-10")]));

    expect((await readProfile()).pills).toBe(0);
    expect((await db().lessons.toArray())[0].pills).toBe(0);
  });

  it("lekci, kterou zařízení už má, nepřidá podruhé", async () => {
    await recordLesson({
      lessonId: "a",
      answers: Array.from({ length: 7 }, (_, index) => odpoved(true, index)),
      reward: { xp: 90, pills: 24, correct: 7, count: 7, flawless: true },
    });
    const before = await readProfile();

    const result = await restoreLessons(gateway([lekce("a", "2026-09-10")]));

    expect(result.added).toBe(0);
    expect(await db().lessons.count()).toBe(1);
    // Prášky vydělané na tomhle zařízení obnova nesmí sebrat.
    expect((await readProfile()).pills).toBe(before.pills);
  });

  it("opakovaná obnova skóre nenafoukne", async () => {
    const server = gateway([lekce("a", "2026-09-10"), lekce("b", "2026-09-11")]);
    await restoreLessons(server);
    const druhy = await restoreLessons(server);

    expect(druhy.added).toBe(0);
    expect((await readProfile()).xp).toBe(180);
    expect(await db().lessons.count()).toBe(2);
  });

  it("sérii složí z po sobě jdoucích dnů", async () => {
    await restoreLessons(
      gateway([
        lekce("a", "2026-09-09"),
        lekce("b", "2026-09-10"),
        lekce("c", "2026-09-11"),
      ]),
    );

    expect(await readProfile()).toMatchObject({ streakDays: 3, lastLessonDay: "2026-09-11" });
  });

  it("vynechaný den sérii přeruší, ochrany se zpětně neuplatní", async () => {
    await db().profile.put({ ...(await readProfile()), id: PROFILE_ID, streakFreezes: 2 });
    await restoreLessons(
      gateway([
        lekce("a", "2026-09-01"),
        lekce("b", "2026-09-02"),
        lekce("c", "2026-09-11"),
      ]),
    );

    const profile = await readProfile();
    expect(profile.streakDays).toBe(1);
    // Koupené ochrany zůstávají k dispozici do budoucna.
    expect(profile.streakFreezes).toBe(2);
  });

  it("nedohraná lekce se počítá podle odpovědí, ne podle plné délky", async () => {
    const result = await restoreLessons(gateway([{ ...lekce("a", "2026-09-10"), answers: [odpoved(true)] }]));

    expect(result.xp).toBe(30);
    expect((await db().lessons.toArray())[0]).toMatchObject({ count: 1, correct: 1, flawless: true });
  });
});

describe("stahování novinek", () => {
  it("poprvé stáhne celou historii, podruhé se ptá jen na novinky", async () => {
    const server = gateway([lekce("a", "2026-09-10"), lekce("b", "2026-09-11")]);

    expect(await pullNews("uzivatel-1", server)).toMatchObject({ added: 2 });
    expect(server.since).toEqual([undefined]);

    expect(await pullNews("uzivatel-1", server)).toMatchObject({ added: 0 });
    // Podruhé se ptá od nejnovější známé lekce, ne od začátku.
    expect(server.since[1]).toBe(poledne("2026-09-11"));
  });

  /** Kvůli tomuhle to celé je: co se odehrálo na tabletu, dorazí do telefonu. */
  it("dožene lekci, která vznikla na druhém zařízení", async () => {
    const server = gateway([lekce("a", "2026-09-10")]);
    await pullNews("uzivatel-1", server);

    const tablet = gateway([lekce("a", "2026-09-10"), lekce("b", "2026-09-12")]);
    expect(await pullNews("uzivatel-1", tablet)).toMatchObject({ added: 1 });
    expect((await readProfile()).xp).toBe(180);
  });

  it("jiný účet na témže zařízení se stáhne znovu od začátku", async () => {
    const server = gateway([lekce("a", "2026-09-10")]);
    await pullNews("uzivatel-1", server);

    await pullNews("uzivatel-2", server);
    expect(server.since).toEqual([undefined, undefined]);
  });

  it("po neúspěchu se mez neposune a příště se zkusí znovu", async () => {
    const rozbity: RestoreGateway = {
      async pullLessons() {
        throw new Error("síť je pryč");
      },
    };

    await expect(pullNews("uzivatel-1", rozbity)).rejects.toThrow(/síť/);
    expect((await readProfile()).restoredFor).toBeUndefined();
    expect((await readProfile()).restoredThrough).toBeUndefined();
  });
});
