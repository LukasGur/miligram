import { describe, expect, it } from "vitest";
import {
  bodySurfaceArea,
  bsaBasedDose,
  calvertDose,
  creatinineClearance,
  dividedDose,
  doseVolume,
  dropsPerMinute,
  infusionRateMlPerHour,
  infusionTimeMinutes,
  massInVolume,
  microgramsPerKgMinToMlPerHour,
  microgramsPerMinToMlPerHour,
  minimumDiluentVolume,
  mlPerHourToMicrogramsPerKgMin,
  percentToMgPerMl,
  ratioToMgPerMl,
  reconstitutedConcentration,
  unitsForDose,
  volumeAfterDilution,
  volumeOfStock,
  weightBasedDose,
} from "../formulas";

/**
 * Referenční hodnoty jsou spočítané ručně a navázané na konkrétní
 * registrovaná balení podle docs/zdroje.md. Kde je výsledek celé číslo,
 * je to záměr — takový případ odhalí i chybu v řádu.
 */

describe("základní dávkování", () => {
  it("objem z ampule Furosemid Kabi 20 mg/2 ml pro dávku 15 mg", () => {
    expect(doseVolume(15, 20, 2)).toBe(1.5);
  });

  it("objem z ampule Gentamicin Lek 80 mg/2 ml pro dávku 240 mg", () => {
    expect(doseVolume(240, 80, 2)).toBe(6);
  });

  it("počet tablet PARALEN 500 mg pro dávku 1 g", () => {
    expect(unitsForDose(1000, 500)).toBe(2);
  });

  it("dělená tableta Digoxin Léčiva 0,125 mg pro dávku 0,1875 mg", () => {
    expect(unitsForDose(0.1875, 0.125)).toBe(1.5);
  });

  it("obsah chloridu sodného ve 250 ml roztoku 9 mg/ml", () => {
    expect(massInVolume(9, 250)).toBe(2250);
  });

  it("odmítne nulovou nebo zápornou sílu", () => {
    expect(() => doseVolume(15, 0, 2)).toThrow(/dostupná síla/);
    expect(() => unitsForDose(-1, 500)).toThrow(/požadovaná dávka/);
  });
});

describe("dávkování podle hmotnosti a povrchu těla", () => {
  it("paracetamol 15 mg/kg u dítěte 18 kg", () => {
    expect(weightBasedDose(15, 18)).toBe(270);
  });

  it("60 mg/kg/den ve čtyřech dávkách u dítěte 18 kg", () => {
    expect(dividedDose(60, 18, 4)).toBe(270);
  });

  it("Mostellerův vzorec dá pro 180 cm a 80 kg přesně 2 m²", () => {
    // 180 × 80 = 14 400; 14 400 / 3600 = 4; √4 = 2
    expect(bodySurfaceArea(180, 80)).toBe(2);
  });

  it("Mostellerův vzorec pro 170 cm a 70 kg", () => {
    expect(bodySurfaceArea(170, 70)).toBeCloseTo(1.81812, 5);
  });

  it("paklitaxel 175 mg/m² při povrchu 1,8 m²", () => {
    expect(bsaBasedDose(175, 1.8)).toBe(315);
  });
});

describe("ředění a koncentrace", () => {
  it("procentní roztok na mg/ml", () => {
    expect(percentToMgPerMl(0.9)).toBe(9);
    expect(percentToMgPerMl(40)).toBe(400);
    expect(percentToMgPerMl(7.45)).toBeCloseTo(74.5, 10);
  });

  it("poměrové ředění na mg/ml", () => {
    expect(ratioToMgPerMl(1000)).toBe(1);
    expect(ratioToMgPerMl(10000)).toBe(0.1);
    expect(ratioToMgPerMl(100000)).toBe(0.01);
  });

  it("z glukózy 40 % připraví 500 ml roztoku 10 %", () => {
    // C₁V₁ = C₂V₂ → V₁ = (100 × 500) / 400
    expect(volumeOfStock(400, 100, 500)).toBe(125);
  });

  it("50 ml glukózy 40 % naředěných na 10 % dá 200 ml", () => {
    expect(volumeAfterDilution(400, 50, 100)).toBe(200);
  });

  it("odmítne ředění, které by koncentraci zvýšilo", () => {
    expect(() => volumeOfStock(100, 400, 500)).toThrow(/nekoncentruje/);
  });
});

describe("rekonstituce", () => {
  it("Ceftriaxon Kabi 1 g v 10 ml vody pro injekci dá 100 mg/ml", () => {
    expect(reconstitutedConcentration(1000, 10, 0)).toBe(100);
  });

  it("Vancomycin Kabi 1000 mg ve 20 ml dá 50 mg/ml", () => {
    expect(reconstitutedConcentration(1000, 20, 0)).toBe(50);
  });

  it("započte vlastní objem prášku", () => {
    expect(reconstitutedConcentration(1000, 9.3, 0.7)).toBe(100);
  });

  it("vankomycin 1000 mg vyžaduje při limitu 5 mg/ml nejméně 200 ml", () => {
    expect(minimumDiluentVolume(1000, 5)).toBe(200);
  });
});

describe("rychlost infuze", () => {
  it("1000 ml za 8 hodin je 125 ml/h", () => {
    expect(infusionRateMlPerHour(1000, 480)).toBe(125);
  });

  it("500 ml rychlostí 125 ml/h doběhne za 240 minut", () => {
    expect(infusionTimeMinutes(500, 125)).toBe(240);
  });

  it("kapky za minutu při faktoru 20 gtt/ml", () => {
    // (1000 × 20) / 480
    expect(dropsPerMinute(1000, 20, 480)).toBeCloseTo(41.6667, 4);
  });

  it("mikrokapkový set 60 gtt/ml dává stejné číslo jako ml/h", () => {
    expect(dropsPerMinute(500, 60, 240)).toBe(125);
    expect(infusionRateMlPerHour(500, 240)).toBe(125);
  });
});

describe("kontinuální infuze vazoaktivních látek", () => {
  it("dobutamin 5 µg/kg/min u 80 kg z roztoku 0,5 mg/ml je 48 ml/h", () => {
    // (5 × 80 × 60) / (0,5 × 1000) = 24 000 / 500
    expect(microgramsPerKgMinToMlPerHour(5, 80, 0.5)).toBe(48);
  });

  it("převod tam a zpět je bezeztrátový", () => {
    expect(mlPerHourToMicrogramsPerKgMin(48, 80, 0.5)).toBe(5);
  });

  it("noradrenalin 6 µg/min z roztoku 0,08 mg/ml je 4,5 ml/h", () => {
    expect(microgramsPerMinToMlPerHour(6, 0.08)).toBe(4.5);
  });
});

describe("funkce ledvin a onkologie", () => {
  it("Cockcroft–Gault u muže 70 let, 80 kg, kreatinin 100 µmol/l", () => {
    // 100 µmol/l = 1,13122 mg/dl; (140−70) × 80 / (72 × 1,13122)
    expect(
      creatinineClearance({ ageYears: 70, weightKg: 80, creatinineUmolPerL: 100, female: false }),
    ).toBeCloseTo(68.76, 2);
  });

  it("u ženy je výsledek o 15 % nižší", () => {
    const male = creatinineClearance({
      ageYears: 70, weightKg: 80, creatinineUmolPerL: 100, female: false,
    });
    const female = creatinineClearance({
      ageYears: 70, weightKg: 80, creatinineUmolPerL: 100, female: true,
    });
    expect(female).toBeCloseTo(male * 0.85, 10);
  });

  it("Calvertův vzorec pro AUC 5 a GFR 60 ml/min dá 425 mg", () => {
    expect(calvertDose(5, 60)).toBe(425);
  });

  it("Calvertův vzorec pro AUC 6 a GFR 75 ml/min dá 600 mg", () => {
    expect(calvertDose(6, 75)).toBe(600);
  });
});
