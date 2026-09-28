import { describe, expect, it } from "vitest";
import { friendDuelState } from "@/core/duel";
import { withPendingResult, type PendingResults } from "../duelPending";
import type { DuelResult } from "../remote";

const result = { correct: 5, count: 7, points: 5, items: null };

const duel = {
  id: "d1",
  opponentId: "k",
  status: "accepted" as const,
  challengedByMe: false,
  playedByMe: false,
  mine: null as DuelResult | null,
};

describe("výsledek souboje, který ještě neodešel", () => {
  it("dohraný souboj je dohraný hned, ne až po odpovědi serveru", () => {
    const pending: PendingResults = { d1: { ...result, userId: "me" } };
    const shown = withPendingResult(duel, "me", pending);
    expect(shown.playedByMe).toBe(true);
    expect(shown.mine?.points).toBe(5);
    // Profil tak u kamaráda neukáže „tvůj tah“, ale že je na tahu on.
    expect(friendDuelState([duel], "k")).toBe("myTurn");
    expect(friendDuelState([shown], "k")).toBe("waiting");
  });

  it("cizí výsledek ani výsledek, který server už zná, nic nemění", () => {
    expect(withPendingResult(duel, "me", { d1: { ...result, userId: "jiny" } })).toBe(duel);
    const known = { ...duel, playedByMe: true, mine: { ...result, points: 6 } };
    expect(withPendingResult(known, "me", { d1: { ...result, userId: "me" } })).toBe(known);
  });
});
