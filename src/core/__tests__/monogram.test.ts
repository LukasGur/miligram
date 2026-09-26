import { describe, expect, it } from "vitest";
import { initials, toneOf, TONES } from "../monogram";

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
});
