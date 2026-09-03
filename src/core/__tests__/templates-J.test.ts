import { describe, expect, it } from "vitest";
import "../templates";
import { allTemplates, buildExercise, getTemplate } from "../templates";
import { creatinineClearance } from "../formulas";
import { bandFor, RENAL_RULE_LIST } from "../products/renal";
import { DIFFICULTIES, type Difficulty } from "../types";

const SEEDS = Array.from({ length: 40 }, (_, i) => `j${i}`);
const D = 2 as Difficulty;

describe("tabulka renálních pravidel", () => {
  it("každé pravidlo cituje konkrétní SPC a nese kód SÚKL", () => {
    for (const [id, rule] of RENAL_RULE_LIST) {
      expect(rule.spc, id).toMatch(/^SPC\d+\.pdf$/);
      expect(rule.suklCode, id).toMatch(/^\d{7}$/);
      expect(rule.quote.length, id).toBeGreaterThan(60);
      expect(rule.bands.length, id).toBeGreaterThan(1);
    }
  });

  it("pásma se nepřekrývají a jdou odshora dolů", () => {
    for (const [id, rule] of RENAL_RULE_LIST) {
      for (let i = 1; i < rule.bands.length; i += 1) {
        const above = rule.bands[i - 1];
        const below = rule.bands[i];
        expect(below.minCrCl, `${id} pásmo ${i}`).toBeLessThan(above.minCrCl);
        if (below.maxCrCl !== undefined) {
          expect(below.maxCrCl, `${id} pásmo ${i}`).toBeLessThanOrEqual(above.minCrCl);
        }
      }
    }
  });

  it("hodnota 60 ml/min u karboplatiny do tabulky nepatří — SPC píše „> 60“", () => {
    expect(bandFor("karboplatina", 60)).toBeNull();
    expect(bandFor("karboplatina", 61)?.dose).toBe(400);
    expect(bandFor("karboplatina", 59)?.dose).toBe(250);
    expect(bandFor("karboplatina", 15)).toBeNull();
  });
});

describe("J1 — clearance podle Cockcrofta a Gaulta", () => {
  it("na ručně spočítaném zadání vyjde známá hodnota", () => {
    // Muž 60 let, 80 kg, kreatinin 88,4 µmol/l = 1 mg/dl
    // (140 − 60) × 80 / (72 × 1) = 88,89 ml/min
    const solution = getTemplate("J1").solve(
      { ageYears: 60, weightKg: 80, creatinineUmolPerL: 88.4, female: 0 },
      D,
    );
    expect(solution.value).toBeCloseTo(88.89, 2);
  });

  it("u ženy je výsledek 0,85násobek mužského", () => {
    const vars = { ageYears: 60, weightKg: 80, creatinineUmolPerL: 88.4 };
    const man = getTemplate("J1").solve({ ...vars, female: 0 }, D).value;
    const woman = getTemplate("J1").solve({ ...vars, female: 1 }, D).value;
    expect(woman).toBeCloseTo(man * 0.85, 9);
  });

  it("korekční krok se v řešení objeví jen u žen", () => {
    const keys = (female: number) =>
      getTemplate("J1")
        .solve({ ageYears: 60, weightKg: 80, creatinineUmolPerL: 100, female }, D)
        .steps.map((s) => s.textKey);
    expect(keys(1)).toContain("korekceZeny");
    expect(keys(0)).not.toContain("korekceZeny");
  });
});

describe("J2 — vankomycin podle clearance", () => {
  it("při zachované funkci ledvin je denní dávka dvojnásobek jednotlivé", () => {
    // Muž 40 let, 80 kg, kreatinin 88,4 µmol/l → CrCl 111 ml/min → 15 mg/kg à 12 h
    const solution = getTemplate("J2").solve(
      { ageYears: 40, weightKg: 80, creatinineUmolPerL: 88.4, female: 0 },
      D,
    );
    expect(solution.value).toBe(2400);
  });

  it("při clearance v pásmu 20–49 klesne denní dávka na polovinu", () => {
    // Muž 70 let, 70 kg, kreatinin 250 µmol/l → CrCl ≈ 27 ml/min → 15 mg/kg à 24 h
    const solution = getTemplate("J2").solve(
      { ageYears: 70, weightKg: 70, creatinineUmolPerL: 250, female: 0 },
      D,
    );
    expect(solution.value).toBe(1050);
  });

  it("každé vylosované zadání spadne do některého pásma z SPC", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { vars } = buildExercise("J2", seed, difficulty);
        const crCl = creatinineClearance({
          ageYears: Number(vars.ageYears),
          weightKg: Number(vars.weightKg),
          creatinineUmolPerL: Number(vars.creatinineUmolPerL),
          female: Number(vars.female) === 1,
        });
        expect(bandFor("vankomycinDospeli", Math.round(crCl)), `${difficulty}/${seed}`).not.toBeNull();
      }
    }
  });
});

describe("J3 a J5 — karboplatina podle ledvin", () => {
  it("při clearance nad 60 se dávka nesnižuje", () => {
    // BSA pro 180 cm a 80 kg = 2,00 m²; 400 mg/m² × 2 = 800 mg
    const solution = getTemplate("J3").solve(
      { heightCm: 180, weightKg: 80, crClMlPerMin: 80, product: "" },
      D,
    );
    expect(solution.value).toBeCloseTo(800, 0);
  });

  it("pásmo 41–59 znamená 62,5 % plné dávky", () => {
    expect(getTemplate("J5").solve({ crClMlPerMin: 50, fullDose: 400, product: "" }, D).value).toBe(62.5);
    expect(getTemplate("J5").solve({ crClMlPerMin: 30, fullDose: 400, product: "" }, D).value).toBe(50);
    expect(getTemplate("J5").solve({ crClMlPerMin: 90, fullDose: 400, product: "" }, D).value).toBe(100);
  });
});

describe("J4 — prodloužení intervalu", () => {
  it("eGFR 30–50 znamená po 12 hodinách, 10–29 po 24", () => {
    expect(getTemplate("J4").solve({ egfr: 40, weightKg: 20, product: "" }, D).value).toBe(12);
    expect(getTemplate("J4").solve({ egfr: 20, weightKg: 20, product: "" }, D).value).toBe(24);
  });

  it("odpověď je vždy jeden z intervalů uvedených v tabulce", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        expect([12, 24]).toContain(buildExercise("J4", seed, difficulty).solution.value);
      }
    }
  });
});

describe("kategorie J je kompletní", () => {
  it("registrováno je všech pět šablon", () => {
    const ids = allTemplates().map((t) => t.id).filter((id) => id.startsWith("J"));
    expect(ids.sort()).toEqual(["J1", "J2", "J3", "J4", "J5"]);
  });
});
