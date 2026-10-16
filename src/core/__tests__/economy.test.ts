import { describe, expect, it } from "vitest";
import {
  advanceStreak,
  currentStreak,
  localDay,
  MAX_STREAK_FREEZES,
  PILLS_FLAWLESS_BONUS,
  PILLS_PER_CORRECT,
  rewardForLesson,
  settleStreak,
  REPAIR_COOLDOWN_DAYS,
  REPAIR_COST,
  REPAIR_MAX_MISSED,
  REPAIR_MIN_STREAK,
  repairOffer,
  SIGNUP_BONUS,
  previousBest,
  streakFromDays,
  streakThrough,
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
  /** Den po dni od půlnoci k lekci, jak to dělá telefon. */
  const play = (state: StreakState, day: string) => advanceStreak(settleStreak(state, day).state, day);

  it("o půlnoci pokryje vynechaný den a hned ubude", () => {
    const state = { days: 9, lastDay: "2026-09-01", freezes: 1 };
    const { state: settled, used } = settleStreak(state, "2026-09-03");
    expect(used).toEqual(["2026-09-02"]);
    expect(settled).toMatchObject({ freezes: 0, covered: ["2026-09-02"] });
    expect(currentStreak(settled, "2026-09-03")).toBe(9);
  });

  it("lekce po pokrytém dni sérii prodlouží", () => {
    expect(play({ days: 9, lastDay: "2026-09-01", freezes: 1 }, "2026-09-03")).toMatchObject({
      days: 10,
      lastDay: "2026-09-03",
      freezes: 0,
    });
  });

  it("dva vynechané dny pokryjí dvě ochrany", () => {
    const { state, used } = settleStreak({ days: 9, lastDay: "2026-08-31", freezes: 2 }, "2026-09-03");
    expect(used).toEqual(["2026-09-01", "2026-09-02"]);
    expect(currentStreak(state, "2026-09-03")).toBe(9);
  });

  it("když ochrany dojdou, série spadne a spotřebované se nevracejí", () => {
    // Bug z 13. 10. 2026: jedna ochrana, dva vynechané dny. Ochrana zůstala
    // ve skladu, i když sérii první půlnoc podržela.
    const { state, used } = settleStreak({ days: 14, lastDay: "2026-10-11", freezes: 1 }, "2026-10-14");
    expect(used).toEqual(["2026-10-12"]);
    expect(state.freezes).toBe(0);
    expect(currentStreak(state, "2026-10-14")).toBe(0);
  });

  it("den po vynechání už série visí jen na dnešní lekci", () => {
    const state = settleStreak({ days: 14, lastDay: "2026-10-11", freezes: 1 }, "2026-10-13").state;
    expect(state.freezes).toBe(0);
    expect(currentStreak(state, "2026-10-13")).toBe(14);
    expect(currentStreak(state, "2026-10-14")).toBe(0);
  });

  it("bez rozjeté série se nespotřebuje", () => {
    expect(settleStreak({ days: 0, lastDay: null, freezes: 2 }, "2026-09-03").used).toEqual([]);
    // Série spadla dřív, než ochrana byla: koupená potom ji nevzkřísí.
    const dead = settleStreak({ days: 5, lastDay: "2026-09-01", freezes: 0 }, "2026-09-03").state;
    expect(dead.settled).toBe("2026-09-02");
    const bought = { ...dead, freezes: 1 };
    expect(settleStreak(bought, "2026-09-03").used).toEqual([]);
    expect(settleStreak(bought, "2026-09-05").used).toEqual([]);
    expect(currentStreak(bought, "2026-09-03")).toBe(0);
  });

  it("ochrana koupená týž večer vynechaný den ještě pokryje", () => {
    // Telefon se díval naposledy předevčírem; o včerejšku ještě nerozhodl.
    const state = { days: 5, lastDay: "2026-09-01", freezes: 1, settled: "2026-09-01" };
    expect(settleStreak(state, "2026-09-03").used).toEqual(["2026-09-02"]);
  });

  it("se nespotřebuje, když uživatel přijde v navazujícím dni", () => {
    expect(play({ days: 3, lastDay: "2026-09-02", freezes: 1 }, "2026-09-03").freezes).toBe(1);
  });

  it("opakované dopočítání nic nespotřebuje podruhé", () => {
    const once = settleStreak({ days: 6, lastDay: "2026-09-01", freezes: 2 }, "2026-09-03").state;
    expect(settleStreak(once, "2026-09-03").used).toEqual([]);
    expect(settleStreak(once, "2026-09-03").state.freezes).toBe(1);
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
    for (const day of ["2026-09-01", "2026-09-02", "2026-09-04", "2026-09-05"]) {
      state = advanceStreak(settleStreak(state, day).state, day);
    }
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

describe("ochrana o půlnoci na serveru", () => {
  it("počítá se stejnou zásobou jako aplikace", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/0020_ochrana_o_pulnoci.sql", "utf8");
    // Víc vynechaných dní, než kolik jde držet ochran, server ani nepočítá.
    expect(sql).toContain(`p_through < p_today - ${MAX_STREAK_FREEZES + 1}`);
  });
});

describe("obnova v notifikaci", () => {
  it("server ji nabízí za stejných podmínek jako aplikace", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/0018_pestre_notifikace.sql", "utf8");
    expect(sql).toContain(`>= ${REPAIR_COST}`);
    expect(sql).toContain(`p_streak_days >= ${REPAIR_MIN_STREAK}`);
    expect(sql).toContain(`interval '${REPAIR_COOLDOWN_DAYS} days'`);
    // Chybí jeden až REPAIR_MAX_MISSED dní: od poslední lekce uplynuly dva až tři.
    expect(sql).toContain(`between 2 and ${REPAIR_MAX_MISSED + 1}`);
  });
});

/** Sedm dní v řadě končících daným dnem. */
function tyden(konec: string): string[] {
  const [y, m, d] = konec.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(y, m - 1, d - 6 + i)).toISOString().slice(0, 10),
  );
}

describe("obnovené dny", () => {
  it("série sahá přes pokryté dny až ke včerejšku", () => {
    expect(streakThrough("2026-09-10", ["2026-09-11", "2026-09-12"])).toBe("2026-09-12");
    expect(currentStreak({ days: 9, lastDay: "2026-09-10", freezes: 0, covered: ["2026-09-11", "2026-09-12"] }, "2026-09-13")).toBe(9);
  });

  it("lekce po obnovení sérii prodlouží", () => {
    const state = { days: 9, lastDay: "2026-09-10", freezes: 0, covered: ["2026-09-11"] };
    expect(advanceStreak(state, "2026-09-12")).toMatchObject({ days: 10, lastDay: "2026-09-12" });
  });
});

describe("obnovení série", () => {
  const dny = tyden("2026-09-10");

  it("den po ztrátě: chybí jeden den", () => {
    expect(repairOffer({ lessonDays: dny, today: "2026-09-12" })).toEqual({
      lost: 7,
      missing: ["2026-09-11"],
      until: "2026-09-13",
    });
  });

  it("dva dny po ztrátě: chybí dva dny, pořád ve lhůtě", () => {
    expect(repairOffer({ lessonDays: dny, today: "2026-09-13" })?.missing).toEqual([
      "2026-09-11",
      "2026-09-12",
    ]);
  });

  it("po lhůtě už ne", () => {
    expect(repairOffer({ lessonDays: dny, today: "2026-09-14" })).toBeNull();
  });

  it("série, která žije, se neobnovuje", () => {
    expect(repairOffer({ lessonDays: dny, today: "2026-09-11" })).toBeNull();
  });

  it("krátká série se neobnovuje", () => {
    expect(repairOffer({ lessonDays: dny.slice(1), today: "2026-09-12" })).toBeNull();
  });

  it("obnoví jen to, co ochrany nepokryly", () => {
    expect(repairOffer({ lessonDays: dny, coveredDays: ["2026-09-11"], today: "2026-09-13" })).toEqual({
      lost: 7,
      missing: ["2026-09-12"],
      until: "2026-09-14",
    });
  });

  it("už znovu hrál: obnovení spojí starou řadu s novou", () => {
    expect(repairOffer({ lessonDays: [...dny, "2026-09-12"], today: "2026-09-12" })).toEqual({
      lost: 7,
      missing: ["2026-09-11"],
      until: "2026-09-13",
    });
  });

  it("jednou za třicet dní", () => {
    const input = { lessonDays: dny, today: "2026-09-12" };
    expect(repairOffer({ ...input, lastRepair: "2026-08-20" })).toBeNull();
    expect(repairOffer({ ...input, lastRepair: `2026-08-${13 - (REPAIR_COOLDOWN_DAYS - 30)}` })).not.toBeNull();
  });

  it("po obnovení se nenabízí znovu", () => {
    expect(repairOffer({ lessonDays: dny, coveredDays: ["2026-09-11"], today: "2026-09-12" })).toBeNull();
  });
});

describe("dřívější rekord série", () => {
  it("současná řada se nepočítá", () => {
    expect(previousBest(["2026-09-01", "2026-09-02", "2026-09-03"])).toBe(0);
  });

  it("vezme nejdelší z dřívějších řad", () => {
    const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-05", "2026-09-07", "2026-09-08"];
    expect(previousBest(days)).toBe(3);
  });

  it("pokrytý den řadu nepřeruší, ale nepřičte se", () => {
    expect(previousBest(["2026-09-01", "2026-09-03", "2026-09-06"], ["2026-09-02"])).toBe(2);
  });

  it("bez historie je nula", () => {
    expect(previousBest([])).toBe(0);
  });
});
