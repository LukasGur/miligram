"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import { evaluateAnswer, parseAnswer, type Verdict } from "@/core/answer";
import type { Exercise } from "@/core/types";
import { useAnswerUnit, useExercisePrompt } from "@/i18n/exerciseText";
import { AnswerDisplay } from "./AnswerDisplay";
import { Keypad } from "./Keypad";
import { SolutionSteps } from "./SolutionSteps";
import { VerdictPanel } from "./Verdict";

/** Delší číslo než tohle už není odpověď, ale překlep. */
const MAX_INPUT_LENGTH = 9;

export function ExerciseView({
  exercise,
  index,
  count,
  onExit,
  onAnswered,
}: {
  exercise: Exercise;
  index: number;
  count: number;
  onExit: () => void;
  onAnswered: (correct: boolean) => void;
}) {
  const t = useTranslations("lesson");
  const prompt = useExercisePrompt();
  const answerUnit = useAnswerUnit();

  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [solutionOpen, setSolutionOpen] = useState(false);

  const value = parseAnswer(input);
  const canCheck = value !== null && verdict === null;

  function check() {
    if (value === null) return;
    const result = evaluateAnswer(value, exercise.solution.value, exercise.answer.tolerance);
    setVerdict(result);
    // Postup se u chyby otevře sám. Kdo se splete, potřebuje ho vidět,
    // ne po něm ještě sahat.
    setSolutionOpen(!result.correct);
  }

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <header
        className="app-chrome flex items-center gap-3 px-4 pb-2"
        style={{ paddingTop: "calc(var(--sa-t) + 0.5rem)" }}
      >
        <button
          type="button"
          onClick={onExit}
          aria-label={t("exit")}
          className="text-ink-soft -ml-2 flex size-11 shrink-0 items-center justify-center"
        >
          <CloseIcon className="size-6" />
        </button>
        <Progress index={index} count={count} />
        <span className="num text-ink-soft w-12 shrink-0 text-right text-label" data-numeric>
          {t("progress", { current: index + 1, count })}
        </span>
      </header>

      <div className="scroll-y flex-1">
        <div className="mx-auto w-full max-w-md px-5 pb-6">
          <p className="text-body whitespace-pre-line">{prompt(exercise)}</p>

          <div className="mt-6">
            <AnswerDisplay
              value={input}
              unit={answerUnit(exercise)}
              state={verdict === null ? "editing" : verdict.correct ? "correct" : "wrong"}
            />
          </div>

          {verdict ? (
            <div className="mt-5">
              <VerdictPanel exercise={exercise} verdict={verdict} unit={answerUnit(exercise)} />

              <button
                type="button"
                onClick={() => setSolutionOpen((open) => !open)}
                className="text-accent mt-4 min-h-11 text-label font-medium"
              >
                {solutionOpen ? t("hideSolution") : t("showSolution")}
              </button>

              {solutionOpen ? <SolutionSteps exercise={exercise} /> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="bg-paper border-line shrink-0 border-t"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-md px-5 pt-3">
          {verdict === null ? (
            <Keypad
              onAppend={(character) =>
                setInput((current) => appendCharacter(current, character))
              }
              onBackspace={() => setInput((current) => current.slice(0, -1))}
            />
          ) : null}

          <button
            type="button"
            onClick={verdict === null ? check : () => onAnswered(verdict.correct)}
            disabled={verdict === null && !canCheck}
            className="bg-accent active:bg-accent-press mt-3 min-h-14 w-full rounded-control text-body font-semibold text-white transition-colors duration-75 disabled:opacity-40"
          >
            {verdict === null
              ? t("check")
              : index + 1 === count
                ? t("finish")
                : t("continueLabel")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Do odpovědi patří číslice a jedna desetinná čárka, nic jiného. */
function appendCharacter(current: string, character: string): string {
  if (current.length >= MAX_INPUT_LENGTH) return current;
  if (character === ",") {
    if (current.includes(",")) return current;
    return current === "" ? "0," : `${current},`;
  }
  // Vedoucí nula se nehromadí: 0 → 5 dá 5, ne 05. „0,“ zůstává.
  if (current === "0") return character;
  return current + character;
}

function Progress({ index, count }: { index: number; count: number }) {
  return (
    <div
      className="bg-surface h-1.5 flex-1 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={count}
      aria-valuenow={index}
    >
      <div
        className="bg-accent h-full rounded-full transition-[width] duration-300 ease-[var(--ease-decel)]"
        style={{ width: `${(index / count) * 100}%` }}
      />
    </div>
  );
}
