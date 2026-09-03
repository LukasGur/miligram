import { describe, expect, it } from "vitest";
import "../templates";
import { allTemplates, buildExercise } from "../templates";
import { DIFFICULTIES, type AnswerUnit } from "../types";

/**
 * Jednotka u pole odpovědi a jednotka ve výsledku řešení musí být tatáž.
 *
 * Není to formalita: B7 počítala mg/kg/den, ale u pole svítilo „mg“.
 * Uživatel by odpověděl správně a aplikace by mu to uznala — jenže by se
 * naučil, že výsledek je v miligramech. Chyba, kterou testy hodnot
 * neodhalí, protože číslo sedí.
 */
const EXPECTED: Record<AnswerUnit, string | null> = {
  ng: "\\mathrm{ng}",
  ug: "\\mu g",
  mg: "\\mathrm{mg}",
  g: "\\mathrm{g}",
  ml: "\\mathrm{ml}",
  l: "\\mathrm{l}",
  mmol: "\\mathrm{mmol}",
  mEq: "\\mathrm{mEq}",
  IU: "\\mathrm{IU}",
  min: "\\mathrm{min}",
  h: "\\mathrm{h}",
  den: "@days",
  mlPerHour: "\\mathrm{ml/h}",
  mlPerMin: "\\mathrm{ml/min}",
  dropsPerMinute: "\\mathrm{gtt/min}",
  ugPerKgMin: "\\mu g/kg/min",
  ugPerMin: "\\mu g/min",
  mgPerMl: "\\mathrm{mg/ml}",
  gPerL: "\\mathrm{g/l}",
  mmolPerL: "mmol/l",
  mgPerKgDen: "mg/kg/@day",
  tablet: "\\mathrm{tbl}",
  ampoule: "\\mathrm{amp}",
  vial: "@vialShort",
  pack: "@packShort",
  cycle: "@cycles",
  m2: "\\mathrm{m^2}",
  percent: "\\%",
  // Poměr 1:N se ve výsledku sází bez jednotky — pole ho popisuje samo.
  ratio: null,
};

describe("jednotka odpovědi", () => {
  it("sedí na jednotku ve výsledku řešení", () => {
    const mismatches: string[] = [];

    for (const template of allTemplates()) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of ["u1", "u2", "u3"]) {
          const { answer, solution } = buildExercise(template.id, seed, difficulty);
          const expected = EXPECTED[answer.unit];
          if (expected === null) continue;

          const last = solution.steps.at(-1);
          const shown = last?.result ?? "";
          if (!shown.includes(expected)) {
            mismatches.push(`${template.id}/${difficulty}/${seed}: pole „${answer.unit}“ vs. výsledek „${shown}“`);
          }
        }
      }
    }

    expect(mismatches.slice(0, 6)).toEqual([]);
  });
});
