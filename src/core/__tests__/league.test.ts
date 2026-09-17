import { describe, expect, it } from "vitest";
import { displayTier, PROMOTED, RELEGATED, rankLeague, TOP_TIER } from "../league";

const group = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    userId: `u${i}`,
    handle: `h${i}`,
    // sestupně, ať je pořadí zřejmé
    xp: (count - i) * 10,
  }));

describe("pořadí v lize", () => {
  it("řadí podle týdenních XP sestupně", () => {
    const ranked = rankLeague([
      { userId: "a", handle: "a", xp: 30 },
      { userId: "b", handle: "b", xp: 90 },
      { userId: "c", handle: "c", xp: 60 },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["b", "c", "a"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("při shodě XP rozhoduje přezdívka, aby pořadí neskákalo", () => {
    const first = rankLeague([
      { userId: "a", handle: "zeta", xp: 50 },
      { userId: "b", handle: "alfa", xp: 50 },
    ]);
    const second = rankLeague([
      { userId: "b", handle: "alfa", xp: 50 },
      { userId: "a", handle: "zeta", xp: 50 },
    ]);
    expect(first.map((r) => r.userId)).toEqual(second.map((r) => r.userId));
    expect(first[0].handle).toBe("alfa");
  });

  it("v plné skupině označí první tři a posledních pět", () => {
    const ranked = rankLeague(group(20));
    expect(ranked.filter((r) => r.zone === "promote")).toHaveLength(PROMOTED);
    expect(ranked.filter((r) => r.zone === "relegate")).toHaveLength(RELEGATED);
    expect(ranked[0].zone).toBe("promote");
    expect(ranked.at(-1)?.zone).toBe("relegate");
    // Uprostřed musí zůstat místo, kde se nepostupuje ani nesestupuje.
    expect(ranked.filter((r) => r.zone === null).length).toBe(20 - PROMOTED - RELEGATED);
  });

  it("v malé skupině zóny nekreslí", () => {
    // Osm lidí: tři postupují, pět sestupuje — seznam by byl samá zóna.
    expect(rankLeague(group(8)).every((r) => r.zone === null)).toBe(true);
    expect(rankLeague(group(9)).some((r) => r.zone !== null)).toBe(true);
  });

  it("prázdná skupina nespadne", () => {
    expect(rankLeague([])).toEqual([]);
  });

  it("nemění vstupní pole", () => {
    const entries = group(3);
    const before = entries.map((e) => e.userId);
    rankLeague(entries);
    expect(entries.map((e) => e.userId)).toEqual(before);
  });
});

describe("číslo divize", () => {
  it("nejvyšší divize se ukazuje jako první", () => {
    expect(displayTier(TOP_TIER)).toBe(1);
    expect(displayTier(1)).toBe(TOP_TIER);
  });

  it("postup o stupeň sníží zobrazené číslo", () => {
    // Hráč postupuje z interní 3 na 4; česky je to ze třetí do druhé ligy.
    expect(displayTier(3)).toBe(3);
    expect(displayTier(4)).toBe(2);
  });
});
