"use client";

import { useTranslations } from "next-intl";
import { Formula } from "./Formula";
import { stepEquation } from "@/core/templates/helpers";
import type { Exercise, Source } from "@/core/types";

/**
 * Krokové řešení.
 *
 * Sází se vždy celé, ne jen výsledek. Smysl aplikace není v tom, že
 * uživatel uhodne číslo, ale že uvidí, kde se láme jeho postup — proto má
 * každý krok vlastní název a vzorec je od dosazení oddělený.
 */
export function SolutionSteps({ exercise }: { exercise: Exercise }) {
  const t = useTranslations("lesson");
  const tSteps = useTranslations("exercise.steps");
  const tRounding = useTranslations("exercise.rounding");
  const sources = Array.isArray(exercise.source) ? exercise.source : [exercise.source];

  return (
    <div className="mt-5">
      <h2 className="text-label text-ink-soft font-semibold">{t("solutionTitle")}</h2>

      <ol className="border-line mt-3 space-y-4 border-l pl-4">
        {exercise.solution.steps.map((step, index) => (
          <li key={`${step.textKey}-${index}`} className="relative">
            <span className="bg-line absolute -left-[1.3125rem] top-2 size-2 rounded-full" aria-hidden />
            <p className="text-micro text-ink-soft uppercase tracking-wide">{tSteps(step.textKey)}</p>
            <div className="mt-1 space-y-1 overflow-x-auto">
              {step.formula ? <Formula latex={step.formula} display className="block" /> : null}
              {step.substituted ? <Formula latex={stepEquation(step)!} display className="block" /> : null}
              {step.result && !step.substituted ? (
                <Formula latex={step.result} className="text-ink block font-medium" />
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {exercise.solution.roundingNoteKey ? (
        <section className="bg-surface rounded-panel mt-5 px-4 py-3">
          <h3 className="text-micro text-ink-soft uppercase tracking-wide">{t("roundingTitle")}</h3>
          <p className="text-label mt-1">{tRounding(exercise.solution.roundingNoteKey)}</p>
        </section>
      ) : null}

      <SourceList sources={sources} title={t("sourceTitle")} />
    </div>
  );
}

/**
 * Zdroje se ukazují u každého příkladu, ne schované v nastavení. Je to
 * závazek, který si aplikace dala v pravidlech: co tvrdí o léku, musí umět
 * doložit — a student má vidět, že se to dá dohledat i mimo aplikaci.
 */
function SourceList({ sources, title }: { sources: readonly Source[]; title: string }) {
  return (
    <details className="border-line mt-5 border-t pt-4">
      <summary className="text-micro text-ink-soft cursor-pointer list-none">{title}</summary>
      <ul className="mt-2 space-y-2">
        {sources.map((source) => (
          <li key={source.citation} className="text-micro text-ink-soft">
            {source.citation}
            {source.suklCode ? <span className="num"> · SÚKL {source.suklCode}</span> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
