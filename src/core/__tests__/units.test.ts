import { describe, expect, it } from "vitest";
import {
  convert,
  equivalentsToMillimoles,
  massToMillimoles,
  millimolesToEquivalents,
  millimolesToMass,
  symbolOf,
} from "../units";

describe("převody jednotek", () => {
  it("hmotnost napříč řády", () => {
    expect(convert(1, "g", "mg")).toBe(1000);
    expect(convert(500, "µg", "mg")).toBe(0.5);
    expect(convert(2.5, "mg", "µg")).toBe(2500);
    expect(convert(1, "kg", "g")).toBe(1000);
    expect(convert(1, "mg", "ng")).toBe(1_000_000);
  });

  it("objem a čas", () => {
    expect(convert(1, "l", "ml")).toBe(1000);
    expect(convert(2, "h", "min")).toBe(120);
    expect(convert(90, "min", "h")).toBe(1.5);
    expect(convert(1, "den", "h")).toBe(24);
  });

  it("odmítne převod mezi různými veličinami", () => {
    expect(() => convert(1, "mg", "ml")).toThrow(/různé veličiny/);
  });

  it("odmítne mmol ↔ mEq bez mocenství", () => {
    expect(() => convert(1, "mmol", "mEq")).toThrow(/mocenství/);
    expect(() => convert(1, "mEq", "mmol")).toThrow(/mocenství/);
  });

  it("mmol a mEq u jednomocného draslíku splývají, u vápníku ne", () => {
    expect(millimolesToEquivalents(20, 1)).toBe(20);
    expect(millimolesToEquivalents(2, 2)).toBe(4);
    expect(equivalentsToMillimoles(4, 2)).toBe(2);
  });

  it("hmotnost a látkové množství přes molární hmotnost", () => {
    // KCl má molární hmotnost 74,55 g/mol; 74,55 mg je tedy 1 mmol
    expect(massToMillimoles(74.55, 74.55)).toBe(1);
    expect(millimolesToMass(20, 74.55)).toBe(1491);
  });

  it("symbol jednotky pro zobrazení", () => {
    expect(symbolOf("µg")).toBe("µg");
    expect(symbolOf("ml")).toBe("ml");
  });
});
