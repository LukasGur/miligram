import { describe, expect, it } from "vitest";
import { allTemplates } from "../templates";
import { categoryOfId, templateIdsOf } from "../templateCategories";
import { CATEGORIES } from "../types";

/**
 * Tabulka kategorií je opsaná vedle šablon, aby se dala číst bez fondu
 * přípravků. Tenhle test je jediné, co brání tomu, aby se obě pravdy
 * rozešly.
 */
describe("mapa kategorií", () => {
  it("sedí na šablony oběma směry", () => {
    for (const template of allTemplates()) {
      expect(categoryOfId(template.id)).toBe(template.category);
    }

    const known = new Set(allTemplates().map((template) => template.id));
    for (const category of CATEGORIES) {
      for (const id of templateIdsOf(category)) {
        expect(known.has(id)).toBe(true);
      }
    }
  });

  it("D8 patří k převodům, ne k ředění — prefix písmena nestačí", () => {
    expect(categoryOfId("D8")).toBe("prevody");
  });

  it("neznámá šablona vrátí null, ne výjimku", () => {
    expect(categoryOfId("ZZ9")).toBeNull();
  });
});
