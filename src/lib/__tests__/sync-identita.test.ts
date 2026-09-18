import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it, vi } from "vitest";
import type { LessonEventRow, SyncGateway } from "../sync";

/**
 * Identita události napříč instalacemi.
 *
 * Server zahazuje duplicity podle dvojice (uživatel, client_event_id).
 * Kdyby se identita brala z pořadového čísla v Dexie, druhé zařízení
 * i čerstvá instalace by začaly zase od jedničky a server by jejich lekce
 * tiše zahodil jako už viděné — uživatel by o XP přišel bez jediné chyby.
 *
 * Test proto obě instalace opravdu vytvoří od nuly: smaže databázi, načte
 * modul znovu a teprve pak nahraje lekci. Vlastní soubor má kvůli tomu,
 * že mazání databáze a `resetModules` by ostatním testům podtrhlo instanci.
 */
const LESSON = {
  lessonId: "abc",
  answers: [{ templateId: "A1", seed: "abc:0", difficulty: 1, correct: true, hinted: false, repaired: false }],
  reward: { xp: 10, pills: 2, correct: 1, count: 1, flawless: true },
};

/** Čerstvá instalace: prázdná databáze i prázdný modul. */
async function novaInstalace(): Promise<LessonEventRow[]> {
  await Dexie.delete("miligram");
  vi.resetModules();
  const { recordLesson, db } = await import("../db");
  const { syncOutbox } = await import("../sync");

  await recordLesson(LESSON);
  const sent: LessonEventRow[] = [];
  const gateway: SyncGateway = {
    async pushLessonEvents(rows) {
      sent.push(...rows);
    },
  };
  await syncOutbox(gateway);
  // Pořadové číslo je v obou instalacích stejné — právě proto se nesmí posílat.
  expect((await db().outbox.toArray())[0].id).toBe(1);
  return sent;
}

describe("identita události", () => {
  it("druhá instalace neposílá tytéž identifikátory jako první", async () => {
    const prvni = await novaInstalace();
    const druha = await novaInstalace();

    expect(prvni).toHaveLength(1);
    expect(druha).toHaveLength(1);
    expect(druha[0].client_event_id).not.toBe(prvni[0].client_event_id);
  });
});
