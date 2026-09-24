"use client";

import { useTranslations } from "next-intl";
import { Formula } from "./Formula";
import { stepEquation } from "@/core/templates/helpers";
import { pressable } from "@/lib/press";
import { ArrowUpRightIcon, BookIcon, ChevronDownIcon } from "@/components/icons";
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

      <SourceList
        sources={sources}
        productCode={typeof exercise.vars.code === "string" ? exercise.vars.code : undefined}
        title={t("sourceTitle")}
      />
    </div>
  );
}

/**
 * Kód SÚKL, ke kterému se zdroj vztahuje. Buď ho zdroj nese sám, nebo jde
 * o plošný zdroj SÚKL (databáze léčiv, SPC) a přípravek určuje příklad.
 */
function suklCodeFor(source: Source, productCode: string | undefined): string | undefined {
  if (source.suklCode) return source.suklCode;
  return source.url?.startsWith("https://opendata.sukl.cz/") ? productCode : undefined;
}

/**
 * Kam zdroj vede. U přípravku s kódem SÚKL rovnou na jeho detail v databázi
 * léčiv — obecná stránka katalogu otevřených dat by studentovi nic neukázala.
 * Adresu skládá stejně i aplikace SÚKL (`#/leciva/` + kód).
 */
function sourceHref(source: Source, code: string | undefined): string | undefined {
  if (code) return `https://prehledy.sukl.cz/prehled_leciv.html#/leciva/${code}`;
  return source.url;
}

/**
 * Zdroje se ukazují u každého příkladu, ne schované v nastavení. Je to
 * závazek, který si aplikace dala v pravidlech: co tvrdí o léku, musí umět
 * doložit — a student má vidět, že se to dá dohledat i mimo aplikaci.
 *
 * Sbalené, ale jako ovládací prvek: rámeček, šipka a počet. Holý šedý
 * nadpis nikdo nerozklikl. Po rozbalení se seznam doroluje do zorného
 * pole — jinak by zůstal schovaný pod lištou s tlačítkem Pokračovat
 * a ťuknutí by vypadalo, že nic neudělalo.
 */
function SourceList({
  sources,
  productCode,
  title,
}: {
  sources: readonly Source[];
  productCode: string | undefined;
  title: string;
}) {
  const t = useTranslations("lesson");

  return (
    <details
      // Rezerva pod panelem, aby po dorolování nedosedal na lištu dole.
      className="group border-line mt-5 scroll-mb-4 rounded-control border"
      onToggle={(event) => {
        const details = event.currentTarget;
        if (!details.open) return;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        requestAnimationFrame(() =>
          details.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }),
        );
      }}
    >
      <summary
        {...pressable}
        className="press text-ink data-pressed:bg-surface-press flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-control px-3 text-label font-medium [&::-webkit-details-marker]:hidden"
      >
        <BookIcon className="text-ink-soft size-5 shrink-0" />
        <span className="flex-1">{title}</span>
        <span aria-hidden className="bg-surface text-ink-soft num rounded-readout px-1.5 py-0.5 text-micro">
          {sources.length}
        </span>
        <span className="sr-only">{t("sourceCount", { count: sources.length })}</span>
        <ChevronDownIcon className="text-ink-soft size-5 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
      </summary>

      <ul className="border-line divide-line divide-y border-t px-3">
        {sources.map((source) => {
          const code = suklCodeFor(source, productCode);
          const href = sourceHref(source, code);
          return (
            <li key={source.citation} className="py-3">
              <p className="text-ink text-label">{source.citation}</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                {code ? (
                  <span className="text-ink-soft num text-micro">SÚKL {code}</span>
                ) : (
                  <span />
                )}
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent -my-2 -mr-2 inline-flex min-h-11 items-center gap-1 px-2 text-label font-medium"
                  >
                    {t("sourceOpen")}
                    <ArrowUpRightIcon className="size-4" />
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
