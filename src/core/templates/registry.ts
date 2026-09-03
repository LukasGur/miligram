import type { Difficulty, Exercise, Source, Template } from "../types";
import { createRng } from "../random";

/**
 * Zdroje, které sdílí většina šablon. Konkrétní SPC si každá šablona
 * uvádí sama — tady je jen to, co platí plošně.
 */
export const SUKL_DLP: Source = {
  citation:
    "SÚKL, Databáze léčivých přípravků, vydání 27. 8. 2026 — název, síla, " +
    "léková forma a velikost balení registrovaných přípravků.",
  url: "https://opendata.sukl.cz/?q=katalog/databaze-lecivych-pripravku-dlp",
  verifiedAt: "2026-09-02",
};

export const ISO_7886: Source = {
  citation: "ČSN EN ISO 7886-1 — tolerance objemu odměřeného injekční stříkačkou.",
  url: "https://www.iso.org/standard/14835.html",
  verifiedAt: "2026-09-03",
};

const templates = new Map<string, Template>();

export function register(template: Template): Template {
  if (templates.has(template.id)) {
    throw new Error(`Šablona ${template.id} je zaregistrovaná dvakrát.`);
  }
  templates.set(template.id, template);
  return template;
}

export function getTemplate(id: string): Template {
  const template = templates.get(id);
  if (!template) throw new Error(`Šablona ${id} neexistuje.`);
  return template;
}

/**
 * Šablony použitelné v produkci. Ty s nedohledaným faktickým údajem
 * se do losování nedostanou, i když jsou v kódu hotové.
 */
export function productionTemplates(): Template[] {
  return [...templates.values()].filter((t) => !t.needsReview);
}

export function allTemplates(): Template[] {
  return [...templates.values()];
}

/**
 * Sestaví konkrétní příklad. Dvojice (šablona, semínko) ho určuje
 * jednoznačně, takže ho jde zopakovat i poslat protihráči v souboji.
 */
export function buildExercise(templateId: string, seed: string, difficulty: Difficulty): Exercise {
  const template = getTemplate(templateId);
  const rng = createRng(`${templateId}:${difficulty}:${seed}`);
  const vars = template.generate(rng, difficulty);
  const solution = template.solve(vars, difficulty);

  if (!Number.isFinite(solution.value)) {
    throw new Error(`Šablona ${templateId} vrátila neplatný výsledek pro semínko ${seed}.`);
  }
  return {
    templateId,
    seed,
    difficulty,
    vars,
    answer: typeof template.answer === "function" ? template.answer(vars, solution) : template.answer,
    solution,
  };
}
