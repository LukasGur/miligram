import { describe, expect, it } from "vitest";
import { PRODUCTS, concentrationOf, pickProduct, selectProducts } from "../products";
import { createRng } from "../random";

/**
 * Fond se generuje z dat SÚKL, takže se netestuje jeho obsah, ale jeho
 * integrita: co projde do aplikace, musí být použitelné ve výpočtu.
 */
describe("fond přípravků", () => {
  it("není prázdný a pokrývá všechny skupiny", () => {
    const kinds = new Set(PRODUCTS.map((p) => p.kind));
    expect(PRODUCTS.length).toBeGreaterThan(300);
    expect([...kinds].sort()).toEqual([
      "ampoule", "concentrate", "infusionBag", "oralLiquid", "powderVial", "tablet",
    ]);
  });

  it("každý přípravek má kód SÚKL a je uvedený jen jednou", () => {
    const codes = PRODUCTS.map((p) => p.code);
    expect(codes.every((code) => /^\d{7}$/.test(code))).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("síla je vždy kladné konečné číslo", () => {
    const bad = PRODUCTS.filter((p) => !Number.isFinite(p.strength) || p.strength <= 0);
    expect(bad).toEqual([]);
  });

  it("tablety a lyofilizáty nemají objem, tekuté formy ho mají", () => {
    const withoutVolume = PRODUCTS.filter((p) => p.kind === "tablet" || p.kind === "powderVial");
    expect(withoutVolume.every((p) => p.volumeMl === undefined)).toBe(true);

    const withVolume = PRODUCTS.filter((p) =>
      p.kind === "ampoule" || p.kind === "concentrate" || p.kind === "infusionBag" || p.kind === "oralLiquid",
    );
    expect(withVolume.every((p) => (p.volumeMl ?? 0) > 0)).toBe(true);
  });

  it("každý přípravek má název účinné látky z číselníku ATC", () => {
    const bad = PRODUCTS.filter((p) => p.substance.trim() === "" || !/^[A-Z]\d{2}[A-Z]{2}\d{2}$|^[A-Z]\d{2}[A-Z]{1,2}$/.test(p.atc));
    expect(bad.map((p) => `${p.code} ${p.name}`)).toEqual([]);
  });

  it("filtr zužuje výběr podle skupiny i rozsahu síly", () => {
    const ampoules = selectProducts({ kind: "ampoule" });
    expect(ampoules.length).toBeGreaterThan(50);
    expect(ampoules.every((p) => p.kind === "ampoule")).toBe(true);

    const small = selectProducts({ kind: "ampoule", maxStrength: 10 });
    expect(small.every((p) => p.strength <= 10)).toBe(true);
    expect(small.length).toBeLessThan(ampoules.length);
  });

  it("losování je deterministické a respektuje filtr", () => {
    const filter = { kind: "powderVial", minStrength: 500 } as const;
    const a = pickProduct(createRng("E1:7"), filter);
    const b = pickProduct(createRng("E1:7"), filter);
    expect(a.code).toBe(b.code);
    expect(a.strength).toBeGreaterThanOrEqual(500);
  });

  it("prázdný výběr je chyba šablony, ne tichý průchod", () => {
    expect(() => pickProduct(createRng(1), { kind: "tablet", minStrength: 1e9 })).toThrow(/Fond neobsahuje/);
  });

  it("koncentrace se počítá jen tam, kde je objem", () => {
    const ampoule = selectProducts({ kind: "ampoule" })[0];
    expect(concentrationOf(ampoule)).toBeCloseTo(ampoule.strength / (ampoule.volumeMl ?? 1), 10);

    const tablet = selectProducts({ kind: "tablet" })[0];
    expect(() => concentrationOf(tablet)).toThrow(/nemá uvedený objem/);
  });
});
