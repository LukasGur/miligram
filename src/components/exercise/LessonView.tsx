"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { lessonExercise, planLesson } from "@/core/lesson";
import { scoreLesson } from "@/core/scoring";
import { ExerciseView } from "./ExerciseView";

/**
 * Průběh lekce.
 *
 * Drží jen pořadové číslo a seznam výsledků. Zadání se nikam neukládá —
 * příklad je určený dvojicí (šablona, semínko), takže se dá kdykoli
 * sestavit znovu ze samotného identifikátoru lekce.
 */
export function LessonView({ lessonId, onExit }: { lessonId: string; onExit: () => void }) {
  const plan = useMemo(() => planLesson(lessonId), [lessonId]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const exercise = useMemo(
    () => (index < plan.items.length ? lessonExercise(plan, index) : null),
    [plan, index],
  );

  if (exercise === null) {
    return <LessonSummary answers={answers} onExit={onExit} />;
  }

  return (
    <ExerciseView
      /**
       * Klíč vynutí novou instanci pro každý příklad. Rozepsaná odpověď,
       * verdikt i odrolování se tím vynulují samy — bez efektu, který by
       * stav uklízel ručně.
       */
      key={`${exercise.templateId}:${exercise.seed}`}
      exercise={exercise}
      index={index}
      count={plan.items.length}
      onExit={onExit}
      onAnswered={(correct) => {
        setAnswers((current) => [...current, correct]);
        setIndex((current) => current + 1);
      }}
    />
  );
}

function LessonSummary({ answers, onExit }: { answers: readonly boolean[]; onExit: () => void }) {
  const t = useTranslations("lesson");
  const tHome = useTranslations("home");
  const format = useFormatter();
  const result = scoreLesson(answers);

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <div className="scroll-y flex-1">
        <div
          className="mx-auto flex w-full max-w-md flex-col justify-center px-5"
          style={{ paddingTop: "calc(var(--sa-t) + 3rem)" }}
        >
          <h1 className="text-title font-semibold">{t("summaryTitle")}</h1>

          <p className="num text-display mt-6 font-semibold" data-numeric>
            {t("summaryScore", { correct: result.correct, count: result.count })}
          </p>

          {result.flawless ? (
            <p className="text-accent mt-2 text-heading font-semibold">{t("summaryPerfect")}</p>
          ) : null}

          <dl className="border-line divide-line mt-8 grid grid-cols-2 divide-x border-y py-4">
            <div className="pr-3">
              <dt className="text-ink-soft text-micro">{tHome("xp")}</dt>
              <dd className="num mt-0.5 text-title font-semibold">{format.number(result.xp)}</dd>
            </div>
            <div className="pl-3">
              <dt className="text-ink-soft text-micro">{tHome("pills")}</dt>
              {/* Prášky se zatím nikam neukládají, takže se ani nepředstírají. */}
              <dd className="num text-ink-soft mt-0.5 text-title font-semibold">–</dd>
            </div>
          </dl>

          <p className="text-ink-soft mt-4 text-label">{t("summaryPending")}</p>
        </div>
      </div>

      <div
        className="bg-paper border-line shrink-0 border-t"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-md px-5 pt-3">
          <button
            type="button"
            onClick={onExit}
            className="bg-accent active:bg-accent-press min-h-14 w-full rounded-control text-body font-semibold text-white transition-colors duration-75"
          >
            {t("home")}
          </button>
        </div>
      </div>
    </div>
  );
}
