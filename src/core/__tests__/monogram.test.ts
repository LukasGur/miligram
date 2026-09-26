import { describe, expect, it } from "vitest";
import { initials, resolveTone, toneOf, TONES } from "../monogram";

describe("monogram", () => {
  it("bere první písmena částí přezdívky", () => {
    expect(initials("jana_k")).toBe("JK");
    expect(initials("tomas.v")).toBe("TV");
    expect(initials("eva")).toBe("EV");
    expect(initials("x")).toBe("X");
    expect(initials("_petr_")).toBe("PE");
  });

  it("tón je stálý a v rozsahu", () => {
    expect(toneOf("jana_k")).toBe(toneOf("JANA_K"));
    for (const handle of ["a", "eva", "petr_m", "klara", "ondra_s", "m_dvorak"]) {
      expect(toneOf(handle)).toBeGreaterThanOrEqual(0);
      expect(toneOf(handle)).toBeLessThan(TONES);
    }
  });

  it("tóny se mezi přezdívkami rozptýlí", () => {
    const tones = new Set(Array.from({ length: 64 }, (_, i) => toneOf(`user_${i}`)));
    expect(tones.size).toBe(TONES);
  });

  it("vybraný tón má přednost, neplatný se nahradí tím z přezdívky", () => {
    expect(resolveTone("jana_k", 3)).toBe(3);
    expect(resolveTone("jana_k", 0)).toBe(0);
    expect(resolveTone("jana_k", null)).toBe(toneOf("jana_k"));
    expect(resolveTone("jana_k", TONES)).toBe(toneOf("jana_k"));
    expect(resolveTone("jana_k", 1.5)).toBe(toneOf("jana_k"));
  });

  it("počet tónů souhlasí s migrací i s barvami v globals.css", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/0013_ton_monogramu.sql", "utf8");
    expect(sql).toContain(`between 0 and ${TONES - 1}`);
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css.match(/--color-tone-\d+:/g)?.length).toBe(TONES);
    expect(css.match(/--color-tone-\d+-wash:/g)?.length).toBe(TONES);
  });
});
