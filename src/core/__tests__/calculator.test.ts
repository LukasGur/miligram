import { describe, expect, it } from "vitest";
import { evaluate, format, parse, render, type Token } from "../calculator";

const cislo = (value: number): Token => ({ kind: "number", value });
const op = (value: "+" | "-" | "*" | "/"): Token => ({ kind: "operator", value });

describe("kalkulačka", () => {
  it("spočítá řetěz dělení a násobení, jak se výpočet dávky píše", () => {
    // 14,9 mg/ml ÷ 74,5 g/mol × 1000 = 200 mmol/l
    expect(evaluate([cislo(14.9), op("/"), cislo(74.5), op("*"), cislo(1000)])).toBe(200);
  });

  it("násobení má přednost před sčítáním", () => {
    expect(evaluate([cislo(2), op("+"), cislo(3), op("*"), cislo(4)])).toBe(14);
  });

  it("odčítá zleva doprava", () => {
    expect(evaluate([cislo(10), op("-"), cislo(3), op("-"), cislo(2)])).toBe(5);
  });

  it("rozepsaný zápis nedává výsledek", () => {
    expect(evaluate([cislo(5), op("+")])).toBeNull();
    expect(evaluate([])).toBeNull();
  });

  it("dělení nulou nevrátí nekonečno, ale nic", () => {
    expect(evaluate([cislo(5), op("/"), cislo(0)])).toBeNull();
  });

  it("zápis na displeji používá znaky, na které je student zvyklý", () => {
    expect(render([cislo(2.5), op("*"), cislo(4)], "")).toBe("2,5 × 4");
    expect(render([cislo(8), op("/")], "1")).toBe("8 ÷ 1");
  });

  it("výsledek jde přepsat do odpovědi: desetinná čárka, žádné mezery v tisících", () => {
    expect(format(30000)).toBe("30000");
    expect(format(0.30000000000000004)).toBe("0,3");
  });

  it("nedopsané číslo se nepovažuje za nulu", () => {
    expect(parse("")).toBeNull();
    expect(parse(",")).toBeNull();
    expect(parse("2,5")).toBe(2.5);
  });
});
