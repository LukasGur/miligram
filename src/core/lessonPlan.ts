import type { Difficulty } from "./types";

/**
 * Tvar lekce bez šablon.
 *
 * Je to schválně vlastní soubor: fond přípravků a všech 72 šablon váží
 * 300 kB a domovská obrazovka je nepotřebuje. Stačí jí délka lekce a nové
 * id, takže se sem dalo to, co se dá říct o lekci, aniž by se sáhlo
 * na obsah. Sestavování lekce zůstává v `lesson.ts`.
 */

/** Délka lekce je pevná napříč aplikací; počítá se z ní ekonomika. */
export const LESSON_LENGTH = 7;

/**
 * Náběh obtížnosti. Lekce začíná lehce, aby se uživatel chytil, a končí
 * nejtěžším příkladem — poslední je ten, který si zapamatuje.
 */
export const DIFFICULTY_RAMP: readonly Difficulty[] = [1, 1, 2, 2, 2, 3, 3];

export type LessonPlan = {
  id: string;
  items: readonly { templateId: string; seed: string; difficulty: Difficulty }[];
};

/**
 * Nové id lekce. Náhodné, ale zapsatelné — dá se opsat i nadiktovat,
 * což bude potřeba u soubojů. Náhoda v něm zároveň dělá identitu, která
 * se nepotká s jiným zařízením.
 */
export function newLessonId(): string {
  const now = Date.now().toString(36);
  const salt = Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, "0");
  return `${now}${salt}`;
}
