import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, recordLesson } from "../db";
import { templateFamiliarity } from "../learning";

const answer = (templateId: string, correct: boolean, hinted = false) => ({
  templateId,
  seed: `${templateId}:${correct}:${hinted}`,
  difficulty: 1,
  correct,
  hinted,
});

beforeEach(async () => {
  const database = db();
  await database.transaction("rw", database.tables, async () => {
    await Promise.all(database.tables.map((table) => table.clear()));
  });
});

describe("znalost typů", () => {
  it("nováček nezná nic", async () => {
    const { seen, mastered } = await templateFamiliarity();
    expect(seen.size).toBe(0);
    expect(mastered.size).toBe(0);
  });

  it("viděný typ není zvládnutý, dokud nevyjde bez nápovědy", async () => {
    await recordLesson({
      lessonId: "l",
      answers: [answer("A1", false), answer("B1", true, true), answer("C1", true)],
      reward: { xp: 10, pills: 2, correct: 2, count: 3, flawless: false },
    });
    const { seen, mastered } = await templateFamiliarity();
    expect([...seen].sort()).toEqual(["A1", "B1", "C1"]);
    expect([...mastered]).toEqual(["C1"]);
  });
});
