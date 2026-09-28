import { describe, expect, it } from "vitest";
import {
  advanceStreak,
  currentStreak,
  localDay,
  PILLS_FLAWLESS_BONUS,
  PILLS_PER_CORRECT,
  rewardForLesson,
  SIGNUP_BONUS,
  streakFromDays,
  type StreakState,
} from "../economy";

describe("série", () => {
  it("první dokončená lekce začíná sérii na jedničce", () => {
    expect(advanceStreak({ days: 0, lastDay: null, freezes: 0 }, "2026-09-03")).toEqual({
      days: 1,
      lastDay: "2026-09-03",
      freezes: 0,
    });
  });

  it("lekce v navazujícím dni sérii prodlouží", () => {
    expect(advanceStreak({ days: 4, lastDay: "2026-09-02", freezes: 0 }, "2026-09-03")).toEqual({
      days: 5,
      lastDay: "2026-09-03",
      freezes: 0,
    });
  });

  it("druhá lekce v týž den sérii nezvýší", () => {
    const state = { days: 5, lastDay: "2026-09-03", freezes: 0 };
    expect(advanceStreak(state, "2026-09-03")).toBe(state);
  });

  it("vynechaný den sérii resetuje", () => {
    expect(advanceStreak({ days: 12, lastDay: "2026-08-30", freezes: 0 }, "2026-09-03")).toEqual({
      days: 1,
      lastDay: "2026-09-03",
      freezes: 0,
    });
  });

  it("překlenutí přes konec měsíce i roku", () => {
    expect(advanceStreak({ days: 2, lastDay: "2026-08-31", freezes: 0 }, "2026-09-01").days).toBe(3);
    expect(advanceStreak({ days: 9, lastDay: "2025-12-31", freezes: 0 }, "2026-01-01").days).toBe(10);
  });

  it("zobrazená série spadne na nulu, když uživatel den vynechal", () => {
    const state = { days: 7, lastDay: "2026-09-01", freezes: 0 };
    expect(currentStreak(state, "2026-09-01")).toBe(7);
    expect(currentStreak(state, "2026-09-02")).toBe(7);
    expect(currentStreak(state, "2026-09-03")).toBe(0);
    expect(currentStreak({ days: 0, lastDay: null, freezes: 0 }, "2026-09-03")).toBe(0);
  });

  it("dnešek se počítá podle místního kalendáře, ne podle UTC", () => {
    // 1. 1. 2026 v 00:30 místního času je v UTC ještě 31. 12. — série
    // se ale musí řídit tím, co má uživatel na hodinách.
    const localMidnight = new Date(2026, 0, 1, 0, 30);
    expect(localDay(localMidnight)).toBe("2026-01-01");
  });
});

describe("ochrana série", () => {
  it("pokryje jeden vynechaný den a spotřebuje se", () => {
    const state = { days: 9, lastDay: "2026-09-01", freezes: 1 };
    expect(advanceStreak(state, "2026-09-03")).toEqual({
      days: 10,
      lastDay: "2026-09-03",
      freezes: 0,
    });
  });

  it("dva vynechané dny nepokryje", () => {
    const state = { days: 9, lastDay: "2026-08-31", freezes: 2 };
    // Ochrana je na výpadek, ne na návrat po týdnu — série začíná znovu
    // a ochrana zůstává nedotčená.
    expect(advanceStreak(state, "2026-09-03")).toEqual({
      days: 1,
      lastDay: "2026-09-03",
      freezes: 2,
    });
  });

  it("se nespotřebuje, když uživatel přijde v navazujícím dni", () => {
    const state = { days: 3, lastDay: "2026-09-02", freezes: 1 };
    expect(advanceStreak(state, "2026-09-03").freezes).toBe(1);
  });

  it("drží zobrazenou sérii den po vynechání", () => {
    const state = { days: 6, lastDay: "2026-09-01", freezes: 1 };
    expect(currentStreak(state, "2026-09-03")).toBe(6);
    expect(currentStreak({ ...state, freezes: 0 }, "2026-09-03")).toBe(0);
  });
});

describe("prášky za lekci", () => {
  it("dva za správný příklad, bonus za bezchybnou lekci", () => {
    const answers = Array(7).fill(true);
    expect(rewardForLesson(answers).pills).toBe(7 * PILLS_PER_CORRECT + PILLS_FLAWLESS_BONUS);
  });

  it("chyba bonus zruší, ale správné příklady se počítají dál", () => {
    const answers = [true, true, false, true, true, true, true];
    const reward = rewardForLesson(answers);
    expect(reward.pills).toBe(6 * PILLS_PER_CORRECT);
    expect(reward.xp).toBe(60);
  });

  it("opakování chyb dá jen pastilky za příklady, bonus ne", () => {
    const reward = rewardForLesson([true], "review");
    expect(reward.pills).toBe(PILLS_PER_CORRECT);
    expect(reward.xp).toBe(10);
  });
});

describe("série z historie", () => {
  it("řada dní s lekcí", () => {
    expect(streakFromDays(["2026-09-01", "2026-09-02", "2026-09-03"])).toEqual({ days: 3, lastDay: "2026-09-03" });
  });

  it("vynechaný den řadu přeruší", () => {
    expect(streakFromDays(["2026-09-01", "2026-09-03"])).toEqual({ days: 1, lastDay: "2026-09-03" });
  });

  it("den podržený ochranou řadu nepřeruší, ale nepřičte se", () => {
    expect(streakFromDays(["2026-09-01", "2026-09-03"], ["2026-09-02"])).toEqual({ days: 2, lastDay: "2026-09-03" });
  });

  it("dá totéž jako série posouvaná lekci po lekci", () => {
    let state: StreakState = { days: 0, lastDay: null, freezes: 1 };
    for (const day of ["2026-09-01", "2026-09-02", "2026-09-04", "2026-09-05"]) state = advanceStreak(state, day);
    expect(streakFromDays(["2026-09-01", "2026-09-02", "2026-09-04", "2026-09-05"], ["2026-09-03"]).days).toBe(state.days);
  });

  it("bez lekcí je nula", () => {
    expect(streakFromDays([], ["2026-09-02"])).toEqual({ days: 0, lastDay: null });
  });
});

describe("bonus za registraci", () => {
  it("souhlasí s tím, co připisuje server", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/0014_penezenka.sql", "utf8");
    expect(sql).toContain(`values (me, 'signup', 'signup', ${SIGNUP_BONUS}, 'signup')`);
  });
});
