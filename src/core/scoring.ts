/**
 * XP za lekci.
 *
 * XP je skóre, ne měna: nedá se utratit a slouží k řazení ligy. Kdyby se
 * liga řadila podle prášků, každá vzatá nápověda by uživatele srazila
 * v žebříčku a lidé by se vysvětlením vyhýbali. XP proto drží záznam
 * odvedené práce nezávisle na útratě.
 */
export const XP_PER_CORRECT = 10;
export const XP_FLAWLESS_BONUS = 20;

/**
 * Druh lekce. Opakování chyb ze statistik je často jediný příklad —
 * s bonusem za lekci bez chyby by vyneslo skoro tolik co celá lekce.
 * Počítá se mu proto jen XP za příklady, bonus ne.
 */
export type LessonKind = "lesson" | "review";

export type LessonResult = {
  count: number;
  correct: number;
  flawless: boolean;
  xp: number;
};

export function scoreLesson(answers: readonly boolean[], kind: LessonKind = "lesson"): LessonResult {
  const correct = answers.filter(Boolean).length;
  // Bonus je za lekci bez chyby, ne za plný počet bodů — na tom záleží
  // ve chvíli, kdy lekce skončí předčasně.
  const flawless = answers.length > 0 && correct === answers.length;
  return {
    count: answers.length,
    correct,
    flawless,
    xp: correct * XP_PER_CORRECT + (flawless && kind === "lesson" ? XP_FLAWLESS_BONUS : 0),
  };
}
