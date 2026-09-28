"use client";

import { useEffect, useRef } from "react";
import { useMessages, useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import { useExercisePrompt } from "@/i18n/exerciseText";
import type { Exercise } from "@/core/types";
import { Prompt } from "./Prompt";
import { SolutionSteps } from "./SolutionSteps";

/**
 * Vyřešený vzor k typu příkladu, který student ještě nespočítal sám.
 *
 * Dřív se před novým typem ukazoval sám, přes celou obrazovku — a kdo
 * věděl, jak na to, musel ho pokaždé odklepnout. Teď je to pomůcka
 * v řádku pod odpovědí, na místě nápovědy: kdo neví, sáhne po ní, kdo
 * ví, počítá. Vzor je tatáž šablona s jinými čísly, takže postup sedí
 * přesně a odpověď se nedá opsat.
 */
/**
 * Jedna věta o tom, proč se to počítá právě takhle. Věty píše člověk
 * a před nasazením je čte autor (docs/plan.md, B4) — dokud věta pro šablonu
 * v překladech není, vzor se bez ní obejde. Proto se čte přímo ze zpráv
 * a ne přes typované klíče.
 */
function Why({ templateId }: { templateId: string }) {
  const t = useTranslations("lesson");
  const messages = useMessages() as { exercise?: { why?: Record<string, string> } };
  const why = messages.exercise?.why?.[templateId];
  if (!why) return null;

  return (
    <section className="border-accent mb-5 border-l-2 pl-3.5" aria-label={t("introWhy")}>
      <h3 className="panel-label">{t("introWhy")}</h3>
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
          <Why templateId={example.templateId} />
          <WorkedExample example={example} />
          <p className="text-ink-soft mt-5 text-micro">{t("exampleAgain")}</p>
        </div>
      </div>
    </div>
  );
}
