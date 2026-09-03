"use client";

import { useTranslations } from "next-intl";
import type { Exercise } from "@/core/types";

/**
 * Zadání příkladu jako text.
 *
 * next-intl odvozuje typ klíče z katalogu, takže `t(exercise.templateId)`
 * neprojde typovou kontrolou — klíč vzniká až za běhu. Přetypování je
 * schované tady, na jednom místě, a hlídá ho test `messages.test.ts`:
 * ten sází všechna zadání se skutečnými hodnotami z generátoru a spadne,
 * jakmile některý klíč nebo zástupný symbol nesedí.
 */
type LooseTranslator = (key: string, values?: Record<string, unknown>) => string;

export function useExercisePrompt(): (exercise: Exercise) => string {
  const t = useTranslations("exercise.prompts") as unknown as LooseTranslator;
  return (exercise) => t(exercise.templateId, exercise.vars);
}

export function useAnswerUnit(): (exercise: Exercise) => string {
  const t = useTranslations("exercise.units") as unknown as LooseTranslator;
  return (exercise) => t(exercise.answer.unit);
}
