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
