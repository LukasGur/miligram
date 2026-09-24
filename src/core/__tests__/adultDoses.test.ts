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
    const usable = new Set([...dosedProducts("ampoule"), ...dosedProducts("oralLiquid")].map((d) => d.product.code));
    for (const dose of ADULT_DOSES.values()) {
      expect(codes.has(dose.suklCode), `${dose.product} není ve fondu`).toBe(true);
      expect(usable.has(dose.suklCode), `${dose.product} se v úlohách nepoužije`).toBe(true);
    }
  });
});

describe("základní úlohy zadávají dávku ze SPC", () => {
  for (const id of ["A3", "A4", "A6"]) {
    it(`${id}: ordinace je dávka ze SPC vylosovaného přípravku`, () => {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          const { vars, source } = buildExercise(id, seed, difficulty);
          const dose = adultDoseFor(String(vars.code));
          expect(dose, `${id}/${difficulty}/${seed}`).toBeDefined();
          expect(dose!.singleMg, `${id}/${difficulty}/${seed} ${vars.productName}`).toContain(Number(vars.doseMg));
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
