import { describe, expect, it } from "vitest";
import { firstTryOutcomes, isFinished, nextIndex, solvedCount } from "../lessonRun";
import type { LessonPlan } from "../lessonPlan";

const plan: LessonPlan = {
  id: "l",
  items: Array.from({ length: 7 }, (_, index) => ({
    templateId: `T${index}`,
    seed: `l:${index}`,
    difficulty: 1 as const,
  })),
};

const ok = (index: number) => ({ seed: `l:${index}`, correct: true });
const chyba = (index: number) => ({ seed: `l:${index}`, correct: false });

describe("průběh lekce", () => {
  it("bez pokusů začíná prvním příkladem", () => {
    expect(nextIndex(plan, [])).toBe(0);
  });

  it("po správné odpovědi jde na další", () => {
    expect(nextIndex(plan, [ok(0)])).toBe(1);
  });

  it("chybný příklad se nevrací hned, první průchod se dokončí celý", () => {
    expect(nextIndex(plan, [ok(0), chyba(1)])).toBe(2);
  });

  it("chyby se vrací až po sedmém, v pořadí, v jakém padly", () => {
    const pokusy = [ok(0), chyba(1), ok(2), ok(3), chyba(4), ok(5), ok(6)];
    expect(nextIndex(plan, pokusy)).toBe(1);
    expect(nextIndex(plan, [...pokusy, ok(1)])).toBe(4);
  });

  it("chyba v opakování posílá příklad zase dozadu", () => {
    const pokusy = [chyba(0), chyba(1), ok(2), ok(3), ok(4), ok(5), ok(6)];
    // Nula padla dřív, takže jde první.
    expect(nextIndex(plan, pokusy)).toBe(0);
    // Když zase selže, dostane přednost jednička a nula se vrátí po ní.
    const znovu = [...pokusy, chyba(0)];
    expect(nextIndex(plan, znovu)).toBe(1);
    expect(nextIndex(plan, [...znovu, ok(1)])).toBe(0);
  });

  it("hotovo je, až je správně všech sedm — ne po sedmi odpovědích", () => {
    const sedmChyb = Array.from({ length: 7 }, (_, i) => chyba(i));
    expect(isFinished(plan, sedmChyb)).toBe(false);
    expect(solvedCount(plan, sedmChyb)).toBe(0);

    const dotazeno = [...sedmChyb, ...Array.from({ length: 7 }, (_, i) => ok(i))];
    expect(isFinished(plan, dotazeno)).toBe(true);
    expect(solvedCount(plan, dotazeno)).toBe(7);
  });

  it("odměna se počítá z prvního pokusu, ne z toho, co se doklepalo", () => {
    const pokusy = [ok(0), chyba(1), ok(2), ok(3), ok(4), ok(5), ok(6), ok(1)];
    expect(firstTryOutcomes(plan, pokusy)).toEqual([true, false, true, true, true, true, true]);
  });

  it("nezkoušený příklad se do odměny počítá jako chyba", () => {
    expect(firstTryOutcomes(plan, [ok(0)])).toEqual([true, false, false, false, false, false, false]);
  });
});
