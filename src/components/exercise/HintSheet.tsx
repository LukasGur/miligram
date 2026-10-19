"use client";

import { useTranslations } from "next-intl";
import { reducedMotion } from "@/components/ui/Flyer";
import { useExercisePrompt } from "@/i18n/exerciseText";
import type { Exercise } from "@/core/types";
import { Formula } from "./Formula";
import { Prompt } from "./Prompt";
import { Sheet } from "./Sheet";
import { Button } from "@/components/ui/Button";

/**
 * Nápověda po krocích, v listu zespodu — stejně jako vzor.
 *
 * Platí se jednou za příklad. Další kroky i opětovné otevření u téhož
 * příkladu už nic nestojí: kdo list zavře, aby počítal, a pak se vrátí,
 * nemá platit znovu. Zadání je nahoře v listu, aby kvůli číslům nemusel
 * list zavírat.
 *
 * První krok řešení je přehled zadaných hodnot, a tak se začíná druhým.
 * Každý krok ukáže, co se dělá: obecný vzorec, a kde vzorec není, dosazení
 * bez výsledku — co se má spočítat, ale ne kolik to dá. Hotové číslo se
 * ukáže jen u kroku, který nic jiného nemá a není poslední. Výsledek
 * příkladu nápověda neprozradí nikdy; ten má student spočítat.
 */
export function HintSheet({
  exercise,
  revealed,
  onNext,
  onClose,
}: {
  exercise: Exercise;
  revealed: number;
  onNext: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("lesson");
  const tSteps = useTranslations("exercise.steps");
  const prompt = useExercisePrompt();
  const all = exercise.solution.steps;
  const steps = all.length > 1 ? all.slice(1) : all;
  const last = all[all.length - 1];
  const shown = steps.slice(0, revealed);
  const current = Math.min(revealed, steps.length);
  const done = revealed >= steps.length;

  return (
    <Sheet
      id="hint-title"
      title={t("hintTitle")}
      aside={
        <>
          <span className="num text-ink-soft text-label" data-numeric aria-hidden>
            {t("hintStep", { current, total: steps.length })}
          </span>
          <span className="sr-only" role="status">
            {t("hintStepLabel", { current, total: steps.length })}
          </span>
        </>
      }
      closeLabel={t("hintClose")}
      onClose={onClose}
      footer={
        done ? (
          <p className="text-ink-soft flex min-h-12 items-center text-label">{t("hintDone")}</p>
        ) : (
          <Button
            onClick={onNext}
            className="w-full"
          >
            {t("hintNext")}
          </Button>
        )
      }
    >
      <section className="bg-surface rounded-panel px-4 py-3.5">
        <h3 className="panel-label">{t("hintPrompt")}</h3>
        <div className="mt-1.5">
          <Prompt text={prompt(exercise)} />
        </div>
      </section>

      <ol className="mt-5 space-y-4">
        {shown.map((step, index) => {
          const fresh = index === shown.length - 1 && index > 0;
          return (
            <li
              key={`${step.textKey}-${index}`}
              className={`flex gap-3 ${fresh ? "animate-tick" : ""}`}
              // Nový krok se doroluje do záběru — o snímek později, až se
              // vysázejí vzorce a je jasné, kolik místa zabírá.
              ref={
                fresh
                  ? (node) => {
                      if (!node) return;
                      requestAnimationFrame(() =>
                        node.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" }),
                      );
                    }
                  : undefined
              }
            >
              <span
                className="bg-accent-wash text-accent-press num flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-semibold"
                data-numeric
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body">{tSteps(step.textKey)}</p>
                <div className="mt-1 overflow-x-auto">
                  {step.formula ? (
                    <Formula latex={step.formula} display className="block" />
                  ) : step.substituted ? (
                    <Formula latex={step.substituted} display className="block" />
                  ) : step.result && step !== last ? (
                    <Formula latex={step.result} className="block" />
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-ink-soft mt-5 text-micro">{t("hintAgain")}</p>
    </Sheet>
  );
}
