import { describe, expect, it } from "vitest";
import { pickUnseen, type SeenState } from "../duelSeen";
import type { Duel } from "../remote";

function duel(id: string, resolvedAt: string | null, status: Duel["status"] = "finished"): Duel {
  return {
    id,
    lessonId: `duel:${id}`,
    topic: "mix",
    status,
    opponentId: "k",
    opponentHandle: "kamarad",
    challengedByMe: true,
    createdAt: "2026-09-20T10:00:00.000Z",
    acceptedAt: "2026-09-20T10:00:00.000Z",
    resolvedAt,
    winnerId: "me",
    forfeit: false,
    playedByMe: true,
    playedByThem: true,
    mine: null,
    theirs: null,
  };
}

const state: SeenState = { userId: "me", since: "2026-09-25T00:00:00.000Z", seen: ["b"] };

describe("výsledky soubojů, které uživatel ještě neviděl", () => {
  it("ukáže rozhodnuté souboje od nejstaršího, viděné vynechá", () => {
    const duels = [duel("c", "2026-09-27T09:00:00.000Z"), duel("b", "2026-09-26T09:00:00.000Z"), duel("a", "2026-09-26T08:00:00.000Z")];
    expect(pickUnseen(duels, state).map((one) => one.id)).toEqual(["a", "c"]);
  });

  it("historii z doby před prvním spuštěním nedohání", () => {
    expect(pickUnseen([duel("old", "2026-09-24T23:59:00.000Z")], state)).toEqual([]);
  });

  it("nerozhodnutý, odmítnutý ani propadlý souboj neoznamuje", () => {
    const duels = [duel("x", null, "accepted"), duel("y", "2026-09-26T09:00:00.000Z", "declined"), duel("z", "2026-09-26T09:00:00.000Z", "expired")];
    expect(pickUnseen(duels, state)).toEqual([]);
  });
});
