"use client";

import { useEffect, useRef } from "react";
import { useFormatter, useMessages, useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import { Balance } from "@/components/ui/Balance";
import { TickScale } from "@/components/ui/TickScale";
import { useExercisePrompt } from "@/i18n/exerciseText";
import { pressable } from "@/lib/press";
import type { Category, Exercise } from "@/core/types";
import { Prompt } from "./Prompt";
import { SolutionSteps } from "./SolutionSteps";

/**
 * Nový typ příkladu: nejdřív vyřešený vzor, pak vlastní příklad.
 *
 * Dřív student dostal typ, který nikdy neviděl, naslepo — a učil se až
 * z chyby. Teď před prvním příkladem nového typu vidí tentýž výpočet
 * s jinými čísly, spočítaný krok po kroku. Vzor je z téže šablony, takže
 * postup sedí přesně; jiná čísla zajistí, že se odpověď nedá opsat.
 *
 * Hlavička je stejná jako u příkladu (dílky postupu, zůstatek): karta je
 * součást lekce, ne odbočka z ní.
 */
export function TemplateIntro({
  example,
  category,
  solved,
  count,
  pills,
  onExit,
  onStart,
}: {
  /** Vyřešený vzor — tatáž šablona s jiným semínkem. */
  example: Exercise;
  category: Category;
  solved: number;
  count: number;
  pills: number;
  onExit: () => void;
  onStart: () => void;
}) {
  const t = useTranslations("lesson");
  const tCategories = useTranslations("categories");
  const format = useFormatter();

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
        <TickScale total={count} done={solved} current={solved} label={t("progress", { current: solved, count })} />
        <Balance value={format.number(pills)} label={t("balance", { count: pills })} />
      </header>

      <main tabIndex={0} className="scroll-y flex-1">
        <div className="mx-auto w-full max-w-md px-5 pb-8">
          <p className="panel-label !text-accent animate-rise">
            {t("introEyebrow")} · {tCategories(category)}
          </p>
          <h1 className="text-title animate-rise mt-1.5 font-semibold" style={{ animationDelay: "60ms" }}>
            {t("introTitle")}
          </h1>
          <p className="text-ink-soft animate-rise mt-2 text-label" style={{ animationDelay: "120ms" }}>
            {t("introBody")}
          </p>

          <Why templateId={example.templateId} />

          <div className="animate-rise mt-6" style={{ animationDelay: "180ms" }}>
            <WorkedExample example={example} />
          </div>
        </div>
      </main>

      {/* Hlavní akce dole, pod palcem — jako „Zkontrolovat“ u příkladu. */}
      <footer
        className="bg-paper border-line shrink-0 border-t"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-md px-5 pt-3">
          <button
            type="button"
            onClick={onStart}
            {...pressable}
            className="press press-wide bg-accent data-pressed:bg-accent-press min-h-14 w-full rounded-control text-body font-semibold text-white"
          >
            {t("introStart")}
          </button>
        </div>
      </footer>
    </div>
  );
}

/**
 * Jedna věta o tom, proč se to počítá právě takhle. Věty píše člověk
 * a před nasazením je čte autor (docs/plan.md, B4) — dokud věta pro šablonu
 * v překladech není, karta se bez ní obejde. Proto se čte přímo ze zpráv
 * a ne přes typované klíče.
 */
function Why({ templateId }: { templateId: string }) {
  const t = useTranslations("lesson");
  const messages = useMessages() as { exercise?: { why?: Record<string, string> } };
  const why = messages.exercise?.why?.[templateId];
  if (!why) return null;

  return (
    <section
      className="border-accent animate-rise mt-5 border-l-2 pl-3.5"
      style={{ animationDelay: "150ms" }}
      aria-label={t("introWhy")}
    >
      <h2 className="panel-label">{t("introWhy")}</h2>
      <p className="mt-1 text-body">{why}</p>
    </section>
  );
}

/**
 * Zadání vzoru a jeho řešení. Zadání sedí v podkladu, aby se nepletlo
 * se zadáním, které student počítá; řešení je totéž krokové řešení,
 * jaké vidí po odpovědi — i se zdroji.
 */
function WorkedExample({ example }: { example: Exercise }) {
  const t = useTranslations("lesson");
  const prompt = useExercisePrompt();

  return (
    <>
      <section className="bg-surface rounded-panel px-4 py-3.5">
        <h2 className="panel-label">{t("introExample")}</h2>
        <div className="mt-1.5">
          <Prompt text={prompt(example)} />
        </div>
      </section>
      <SolutionSteps exercise={example} />
    </>
  );
}

/**
 * Vzor během počítání. Vyjede zespodu přes příklad a zavře se křížkem,
 * klepnutím vedle nebo Escapem — rozepsaná odpověď pod ním zůstává.
 */
export function ExampleSheet({ example, onClose }: { example: Exercise; onClose: () => void }) {
  const t = useTranslations("lesson");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("exampleClose")}
        onClick={onClose}
        className="animate-scrim bg-ink/25 absolute inset-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="example-title"
        className="animate-sheet bg-paper relative mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-sheet"
      >
        <div className="border-line flex shrink-0 items-center justify-between border-b py-2 pr-2 pl-5">
          <h2 id="example-title" className="text-heading font-semibold">
            {t("exampleTitle")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("exampleClose")}
            className="text-ink-soft flex size-11 items-center justify-center"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
        <div
          className="scroll-y px-5 pt-4"
          style={{ paddingBottom: "calc(var(--sa-b) + 1.25rem)" }}
          tabIndex={0}
        >
          <WorkedExample example={example} />
        </div>
      </div>
    </div>
  );
}
