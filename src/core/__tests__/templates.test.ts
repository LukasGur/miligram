import { describe, expect, it } from "vitest";
import "../templates";
import { allTemplates, buildExercise, getTemplate, productionTemplates } from "../templates";
import { evaluateAnswer } from "../answer";
import { DIFFICULTIES, type Difficulty } from "../types";

const SEEDS = Array.from({ length: 60 }, (_, i) => `s${i}`);

/**
 * Šablony se testují dvojím způsobem: vlastnostmi, které musí platit pro
 * každé vylosované zadání, a pevnými případy s ručně spočítaným výsledkem.
 * Náhodné zadání nejde otestovat na konkrétní číslo, ale jde na něm ověřit,
 * že příklad vůbec dává smysl.
 */
describe("šablony — vlastnosti platné pro každé zadání", () => {
  const cases = allTemplates().flatMap((template) =>
    DIFFICULTIES.flatMap((difficulty) => SEEDS.map((seed) => [template.id, difficulty, seed] as const)),
  );

  it("každé zadání vede na kladný konečný výsledek", () => {
    const broken: string[] = [];
    for (const [id, difficulty, seed] of cases) {
      const exercise = buildExercise(id, seed, difficulty);
      if (!Number.isFinite(exercise.solution.value) || exercise.solution.value <= 0) {
        broken.push(`${id}/${difficulty}/${seed} → ${exercise.solution.value}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("každé řešení má kroky a končí výsledkem", () => {
    for (const [id, difficulty, seed] of cases.slice(0, 200)) {
      const { solution } = buildExercise(id, seed, difficulty);
      expect(solution.steps.length).toBeGreaterThanOrEqual(3);
      expect(solution.steps.at(-1)?.textKey).toBe("vysledek");
    }
  });

  it("odpověď má jednotku, tolerance je kladná a počet míst rozumný", () => {
    for (const [id, difficulty, seed] of cases.slice(0, 200)) {
      const { answer } = buildExercise(id, seed, difficulty);
      expect(answer.unit).toBeTruthy();
      expect(answer.decimals).toBeGreaterThanOrEqual(0);
      expect(answer.decimals).toBeLessThanOrEqual(3);
      if (answer.tolerance.kind === "absolute" || answer.tolerance.kind === "relative") {
        expect(answer.tolerance.value).toBeGreaterThan(0);
      }
    }
  });

  it("správně zaokrouhlená odpověď projde tolerancí", () => {
    const rejected: string[] = [];
    for (const [id, difficulty, seed] of cases) {
      const { answer, solution } = buildExercise(id, seed, difficulty);
      const rounded = Number(solution.value.toFixed(answer.decimals));
      if (!evaluateAnswer(rounded, solution.value, answer.tolerance).correct) {
        rejected.push(`${id}/${difficulty}/${seed}: ${rounded} vs ${solution.value}`);
      }
    }
    expect(rejected).toEqual([]);
  });

  it("stejné semínko dá stejné zadání, jiné semínko jiné", () => {
    for (const template of allTemplates()) {
      const a = buildExercise(template.id, "duel-42", 2);
      const b = buildExercise(template.id, "duel-42", 2);
      expect(a.vars).toEqual(b.vars);
      expect(a.solution.value).toBe(b.solution.value);
    }
    const varied = new Set(SEEDS.map((s) => JSON.stringify(buildExercise("A3", s, 2).vars)));
    expect(varied.size).toBeGreaterThan(20);
  });

  it("každá šablona má doložený zdroj", () => {
    for (const template of allTemplates()) {
      const sources = Array.isArray(template.source) ? template.source : [template.source];
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect(source.citation.length).toBeGreaterThan(20);
        expect(source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("šablona s nedohledaným údajem se nedostane do produkčního setu", () => {
    const flagged = allTemplates().filter((t) => t.needsReview);
    for (const template of flagged) {
      expect(productionTemplates().map((t) => t.id)).not.toContain(template.id);
    }
  });
});

describe("A3 — objem z ampule", () => {
  it("odebraný objem nikdy nepřesáhne obsah ampule", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { vars, solution } = buildExercise("A3", seed, difficulty);
        expect(solution.value).toBeLessThanOrEqual(Number(vars.ampouleMl) + 1e-9);
      }
    }
  });

  it("na pevném zadání vyjde ručně ověřená hodnota", () => {
    // Furosemid 20 mg ve 2 ml, dávka 15 mg → (15 / 20) × 2 = 1,5 ml
    const solution = getTemplate("A3").solve(
      { doseMg: 15, strengthMg: 20, ampouleMl: 2 },
      2 as Difficulty,
    );
    expect(solution.value).toBe(1.5);
  });

  it("třetí úroveň zadává dávku v mikrogramech", () => {
    const { vars } = buildExercise("A3", "s1", 3);
    expect(vars.doseUnit).toBe("µg");
    expect(Number(vars.doseShown)).toBeCloseTo(Number(vars.doseMg) * 1000, 6);
  });
});

describe("E1 — rekonstituce", () => {
  it("odebraný objem nepřesáhne objem rozpouštědla", () => {
    for (const seed of SEEDS) {
      const { vars, solution } = buildExercise("E1", seed, 2);
      expect(solution.value).toBeLessThanOrEqual(Number(vars.diluentMl) + 1e-9);
    }
  });

  it("na pevném zadání vyjde ručně ověřená hodnota", () => {
    // Ceftriaxon 1 g v 10 ml → 100 mg/ml; dávka 750 mg → 7,5 ml
    const solution = getTemplate("E1").solve(
      { vialMg: 1000, diluentMl: 10, doseMg: 750 },
      2 as Difficulty,
    );
    expect(solution.value).toBe(7.5);
  });

  /**
   * Celá lahvička by znamenala, že odpověď je rozpuštěný objem, který
   * stojí v zadání. První úroveň proto dělí hezkým číslem, ne jedničkou.
   */
  it("první úroveň nepodává celou lahvičku", () => {
    for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
      const { vars, solution } = buildExercise("E1", seed, 1);
      expect(Number(vars.doseMg)).toBeLessThan(Number(vars.vialMg));
      expect(solution.value).not.toBeCloseTo(Number(vars.diluentMl), 6);
    }
  });
});

describe("F2 — kapky za minutu", () => {
  it("na pevném zadání vyjde ručně ověřená hodnota", () => {
    // 1000 ml za 8 hodin setem 20 gtt/ml → (1000 × 20) / 480
    const solution = getTemplate("F2").solve({ bagMl: 1000, dropFactor: 20, hours: 8 }, 2 as Difficulty);
    expect(solution.value).toBeCloseTo(41.6667, 4);
  });

  it("první úroveň nelosuje mikrokapkový set", () => {
    for (const seed of SEEDS) {
      expect(Number(buildExercise("F2", seed, 1).vars.dropFactor)).not.toBe(60);
    }
  });
});

describe("G2 — perfuzor v µg/kg/min", () => {
  it("na pevném zadání vyjde ručně ověřená hodnota", () => {
    // 250 mg v 50 ml = 5 mg/ml; 5 µg/kg/min u 80 kg → (5 × 80 × 60) / (5 × 1000)
    const solution = getTemplate("G2").solve(
      { totalMg: 250, syringeMl: 50, weightKg: 80, dosePerKgMin: 5 },
      2 as Difficulty,
    );
    expect(solution.value).toBe(4.8);
  });

  it("rychlost se drží v rozsahu, který pumpa umí nastavit", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { solution } = buildExercise("G2", seed, difficulty);
        expect(solution.value).toBeGreaterThan(0);
        expect(solution.value).toBeLessThan(1000);
      }
    }
  });
});
