import { describe, expect, it } from "vitest";
import { createRng, seedFrom } from "../random";

describe("deterministický generátor", () => {
  it("stejné semínko dá stejnou posloupnost", () => {
    const a = createRng("A1:42");
    const b = createRng("A1:42");
    const first = Array.from({ length: 20 }, () => a.next());
    const second = Array.from({ length: 20 }, () => b.next());
    expect(first).toEqual(second);
  });

  it("různá semínka dají různé posloupnosti", () => {
    expect(createRng("A1:42").next()).not.toBe(createRng("A1:43").next());
  });

  it("hash řetězce je stabilní a bez znaménka", () => {
    expect(seedFrom("A1:42")).toBe(seedFrom("A1:42"));
    expect(seedFrom("A1:42")).toBeGreaterThanOrEqual(0);
  });

  it("int drží meze včetně krajních hodnot", () => {
    const rng = createRng(1);
    const values = Array.from({ length: 500 }, () => rng.int(3, 7));
    expect(Math.min(...values)).toBe(3);
    expect(Math.max(...values)).toBe(7);
  });

  it("step vrací násobky kroku bez zbytků v plovoucí čárce", () => {
    const rng = createRng("krok");
    for (let i = 0; i < 300; i += 1) {
      const value = rng.step(0.5, 2.5, 0.1);
      expect(value).toBeGreaterThanOrEqual(0.5);
      expect(value).toBeLessThanOrEqual(2.5);
      expect(String(value)).toMatch(/^\d+(\.\d)?$/);
    }
  });

  it("step zvládne i celočíselné kroky", () => {
    const rng = createRng("kg");
    const values = Array.from({ length: 200 }, () => rng.step(40, 100, 5));
    expect(values.every((v) => v % 5 === 0)).toBe(true);
  });

  it("pick nesáhne mimo seznam a odmítne prázdný", () => {
    const rng = createRng("pick");
    const items = ["a", "b", "c"] as const;
    expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow(/prázdného/);
  });
});
