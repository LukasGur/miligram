import { describe, expect, it } from "vitest";
import { evaluateAnswer, parseAnswer } from "../answer";

describe("čtení odpovědi", () => {
  it("přijme českou desetinnou čárku i tečku", () => {
    expect(parseAnswer("1,5")).toBe(1.5);
    expect(parseAnswer("1.5")).toBe(1.5);
    expect(parseAnswer("0,125")).toBe(0.125);
  });

  it("přijme mezeru jako oddělovač tisíců", () => {
    expect(parseAnswer("1 250")).toBe(1250);
    expect(parseAnswer("1 250")).toBe(1250);
  });

  it("prázdné pole není nula", () => {
    expect(parseAnswer("")).toBeNull();
    expect(parseAnswer("   ")).toBeNull();
  });

  it("odmítne text a nesmysly", () => {
    expect(parseAnswer("1,5 ml")).toBeNull();
    expect(parseAnswer("--3")).toBeNull();
    expect(parseAnswer("1,2,3")).toBeNull();
  });
});

describe("vyhodnocení s tolerancí", () => {
  it("počet tablet se posuzuje přesně", () => {
    expect(evaluateAnswer(2, 2, { kind: "exact" }).correct).toBe(true);
    expect(evaluateAnswer(2.1, 2, { kind: "exact" }).correct).toBe(false);
  });

  it("absolutní tolerance u objemu", () => {
    expect(evaluateAnswer(1.55, 1.5, { kind: "absolute", value: 0.05 }).correct).toBe(true);
    expect(evaluateAnswer(1.6, 1.5, { kind: "absolute", value: 0.05 }).correct).toBe(false);
  });

  it("relativní tolerance u rychlosti infuze", () => {
    expect(evaluateAnswer(41.7, 41.6667, { kind: "relative", value: 0.01 }).correct).toBe(true);
    expect(evaluateAnswer(45, 41.6667, { kind: "relative", value: 0.01 }).correct).toBe(false);
  });

  it("tolerance daná zaokrouhlením na desetinná místa", () => {
    expect(evaluateAnswer(1.82, 1.81812, { kind: "decimals", places: 2 }).correct).toBe(true);
    expect(evaluateAnswer(1.81, 1.81812, { kind: "decimals", places: 2 }).correct).toBe(false);
  });
});

describe("rozpoznání chyby o řád", () => {
  it("desetkrát víc", () => {
    const verdict = evaluateAnswer(15, 1.5, { kind: "absolute", value: 0.05 });
    expect(verdict.correct).toBe(false);
    expect(verdict.magnitudeError).toEqual({ factor: 10, exponent: 1 });
  });

  it("desetkrát míň", () => {
    const verdict = evaluateAnswer(0.15, 1.5, { kind: "absolute", value: 0.05 });
    expect(verdict.magnitudeError).toEqual({ factor: 0.1, exponent: -1 });
  });

  it("tisíckrát víc — typická záměna mg a µg", () => {
    const verdict = evaluateAnswer(250_000, 250, { kind: "relative", value: 0.01 });
    expect(verdict.magnitudeError).toEqual({ factor: 1000, exponent: 3 });
  });

  it("pozná posun o řád i u zaokrouhlené odpovědi", () => {
    const verdict = evaluateAnswer(417, 41.6667, { kind: "relative", value: 0.01 });
    expect(verdict.magnitudeError?.exponent).toBe(1);
  });

  it("běžný početní omyl se za chybu o řád nevydává", () => {
    const verdict = evaluateAnswer(3, 1.5, { kind: "absolute", value: 0.05 });
    expect(verdict.correct).toBe(false);
    expect(verdict.magnitudeError).toBeUndefined();
  });

  it("záporná odpověď nespustí detekci řádu", () => {
    expect(evaluateAnswer(-15, 1.5, { kind: "exact" }).magnitudeError).toBeUndefined();
  });
});
