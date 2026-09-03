"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AlertIcon, CheckIcon } from "@/components/icons";
import type { Verdict as AnswerVerdict } from "@/core/answer";
import type { Exercise } from "@/core/types";

/**
 * Moment vyhodnocení.
 *
 * Správná odpověď se hlásí accentem, ne zelenou — aplikace má jen dva
 * významové signály a červená patří výhradně chybě. Chyba o řád dostane
 * vlastní větu: v dávkování je to jediná chyba, u které nestačí říct
 * „špatně“.
 */
export function VerdictPanel({
  exercise,
  verdict,
  unit,
}: {
  exercise: Exercise;
  verdict: AnswerVerdict;
  unit: string;
}) {
  const t = useTranslations("lesson");
  const format = useFormatter();

  const correctValue = format.number(exercise.solution.value, {
    minimumFractionDigits: exercise.answer.decimals,
    maximumFractionDigits: exercise.answer.decimals,
  });

  if (verdict.correct) {
    return (
      <p className="text-accent flex items-center gap-2 text-heading font-semibold">
        <CheckIcon className="size-6 shrink-0" />
        {t("correct")}
      </p>
    );
  }

  const magnitude = verdict.magnitudeError;

  return (
    <div>
      <p className="text-danger flex items-center gap-2 text-heading font-semibold">
        <AlertIcon className="size-6 shrink-0" />
        {t("wrong")}
      </p>
      <p className="text-ink mt-1.5 text-body" data-numeric>
        {t("correctAnswer", { value: correctValue, unit })}
      </p>
      {magnitude ? (
        <p className="text-ink-soft mt-2 text-label">
          {magnitude.exponent > 0
            ? t("magnitudeHigher", { factor: magnitude.factor })
            : t("magnitudeLower", { factor: 1 / magnitude.factor })}
        </p>
      ) : null}
    </div>
  );
}
