import { describe, expect, it } from "vitest";
import "../templates";
import { buildExercise } from "../templates";
import { ADULT_DOSES, adultDoseFor } from "../products/adultDoses";
import { PRODUCTS } from "../products";
import { dosedProducts } from "../templates/ampouleDoses";
import { DIFFICULTIES } from "../types";

const SEEDS = Array.from({ length: 150 }, (_, i) => `davka-${i}`);

/**
 * Základní úlohy smí zadat jen dávku, kterou uvádí SPC. Dřív se losoval
 * násobek obsahu ampule a vycházely ordinace, které by lékař nenapsal.
 */
describe("dávky pro dospělé ze SPC", () => {
  it("každá dávka leží v rozmezí z citace", () => {
    for (const dose of ADULT_DOSES.values()) {
      expect(dose.singleMg.length, dose.product).toBeGreaterThan(0);
      for (const mg of dose.singleMg) {
        expect(mg, dose.product).toBeGreaterThanOrEqual(dose.rangeMg.min);
        expect(mg, dose.product).toBeLessThanOrEqual(dose.rangeMg.max);
      }
      expect(dose.quote.length, dose.product).toBeGreaterThan(40);
      expect(dose.spc, dose.product).toMatch(/^(SPC\d+\.pdf|EMA: [\w-]+\.pdf)$/);
    }
  });

  it("každý záznam patří přípravku, který úlohy skutečně používají", () => {
    const codes = new Set(PRODUCTS.map((p) => p.code));
    const usable = new Set(
      (["ampoule", "oralLiquid", "tablet", "powderVial"] as const).flatMap((kind) => dosedProducts(kind)).map((d) => d.product.code),
    );
    for (const dose of ADULT_DOSES.values()) {
      expect(codes.has(dose.suklCode), `${dose.product} není ve fondu`).toBe(true);
      expect(usable.has(dose.suklCode), `${dose.product} se v úlohách nepoužije`).toBe(true);
    }
  });
});

describe("základní úlohy zadávají dávku ze SPC", () => {
  for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "E1", "E5"]) {
    it(`${id}: ordinace je dávka ze SPC vylosovaného přípravku`, () => {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          const { vars, source } = buildExercise(id, seed, difficulty);
          const dose = adultDoseFor(String(vars.code));
          expect(dose, `${id}/${difficulty}/${seed}`).toBeDefined();
          if (vars.child === "yes") {
            // Dětská dávka ceftriaxonu: 50–80 mg/kg na padesátky, menší než lahvička.
            const mg = Number(vars.doseMg);
            expect(mg % 50, `${id}/${difficulty}/${seed}`).toBe(0);
            expect(mg, `${id}/${difficulty}/${seed}`).toBeLessThan(Number(vars.vialMg));
            expect([source].flat().map((s) => s.citation).join(" ")).toContain("50–80 mg/kg");
          } else {
            expect(dose!.singleMg, `${id}/${difficulty}/${seed} ${vars.productName}`).toContain(Number(vars.doseMg));
          }
          // U příkladu musí být vidět, odkud dávka pochází.
          const citations = [source].flat().map((s) => s.citation).join(" ");
          expect(citations).toContain(dose!.quote);
        }
      }
    });
  }

  it("A3 a A6: dávka je menší než obsah ampule, A4: větší", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        for (const id of ["A3", "A6"]) {
          const { vars } = buildExercise(id, seed, difficulty);
          const content = Number(id === "A3" ? vars.strengthMg : vars.ampouleMg);
          expect(Number(vars.doseMg), `${id}/${seed}`).toBeLessThan(content);
        }
        const { vars } = buildExercise("A4", seed, difficulty);
        expect(Number(vars.doseMg), `A4/${seed}`).toBeGreaterThan(Number(vars.ampouleMg));
      }
    }
  });

  it("A8: podaný objem odpovídá dávce ze SPC", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { vars, solution } = buildExercise("A8", seed, difficulty);
        const mg = difficulty === 3 ? solution.value * 1000 : solution.value;
        const dose = adultDoseFor(String(vars.code));
        expect(dose, `${seed} ${vars.productName}`).toBeDefined();
        expect(dose!.singleMg.some((d) => Math.abs(d - mg) < 1e-6), `${seed} ${vars.productName} ${mg} mg`).toBe(true);
      }
    }
  });
});

describe("tablety, lahvičky a kúry podle SPC", () => {
  it("A7: jednotlivá dávka, četnost i délka léčby jsou ze SPC", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { vars } = buildExercise("A7", seed, difficulty);
        const dose = adultDoseFor(String(vars.code))!;
        const label = `A7/${difficulty}/${seed} ${vars.productName}`;
        expect(dose.singleMg, label).toContain(Number(vars.perDose) * Number(vars.strengthMg));
        expect(dose.timesPerDay, label).toContain(Number(vars.timesPerDay));
        const course = dose.course === "longTerm" ? { min: 28, max: 90 } : dose.course!;
        expect(Number(vars.days), label).toBeGreaterThanOrEqual(course.min);
        expect(Number(vars.days), label).toBeLessThanOrEqual(course.max);
      }
    }
  });

  it("půl tablety jen tam, kde ji SPC dovoluje dělit", () => {
    for (const id of ["A1", "A5", "A7"]) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          const { vars, solution } = buildExercise(id, seed, difficulty);
          const count = id === "A7" ? Number(vars.perDose) : solution.value;
          if (Number.isInteger(count)) continue;
          expect(adultDoseFor(String(vars.code))!.divisibleQuote, `${id}/${seed} ${vars.productName}`).toBeDefined();
        }
      }
    }
  });

  it("E1 rozpouští v objemu z bodu 6.6", () => {
    for (const seed of SEEDS) {
      const { vars } = buildExercise("E1", seed, 2);
      expect(Number(vars.diluentMl)).toBe(adultDoseFor(String(vars.code))!.reconstitution!.diluentMl);
    }
  });
});
