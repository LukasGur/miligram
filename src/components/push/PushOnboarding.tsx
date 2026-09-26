"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon } from "@/components/icons";
import { PushPromises } from "./PushPromises";
import type { DeviceFacts } from "@/lib/push";
import { ReminderPreview } from "./ReminderPreview";
import { usePushPrompt } from "./usePushPrompt";

/** Kroky registrace: e-mail, přezdívka, připomínky. Tohle je poslední. */
const STEPS = 3;

/**
 * Poslední krok založení účtu: připomínky.
 *
 * Chvíle hned po registraci je nejlepší, kdy se ptát — člověk se právě
 * rozhodl zapojit a upozornění stejně chodí jen přihlášeným. Přeskočit
 * jde vždycky a bez trestu; přeskočení se počítá jako první odmítnutí,
 * takže nabídka po lekci přijde nejdřív za týden.
 *
 * Rodič krok ukáže jen tam, kde se upozornění zapnout dají
 * (`usePushPrompt().possible`), a po `onDone` ho zavře.
 */
export function PushOnboarding({
  userId,
  streak,
  facts,
  onDone,
}: {
  userId: string;
  streak: number;
  facts: DeviceFacts;
  onDone: () => void;
}) {
  const t = useTranslations("notifications");
  const prompt = usePushPrompt(userId, facts);
  const { phase, time } = prompt;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Nová obrazovka: čtečka i klávesnice začínají u nadpisu, ne u zavíracího
  // křížku obrazovky, přes kterou krok leží.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [phase]);

  function skip() {
    prompt.dismiss();
    onDone();
  }

  const done = phase === "done";
  const denied = phase === "denied";

  return (
    <div className="bg-paper fixed inset-0 z-40 flex flex-col" role="dialog" aria-modal="true" aria-labelledby="push-onboarding-title">
      <main tabIndex={0} className="scroll-y flex-1">
        {/* Obsah se drží ve svislém středu volného místa, ne u horní hrany —
            jinak by mezi ním a tlačítky zela půl obrazovky prázdna. */}
        <div
          className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 pb-6"
          style={{ paddingTop: "calc(var(--sa-t) + 1.25rem)" }}
        >
          <div className="animate-rise" style={{ animationDelay: "0ms" }}>
            <ol className="flex gap-1.5" aria-label={t("onboardingProgress", { step: STEPS, total: STEPS })}>
              {Array.from({ length: STEPS }, (_, index) => (
                <li
                  key={index}
                  className={`h-1 flex-1 rounded-[1px] ${index < STEPS - 1 || done ? "bg-accent" : "bg-accent/30"}`}
                />
              ))}
            </ol>
            <p className="panel-label mt-3">{t("onboardingLabel")}</p>
          </div>

          <h1
            id="push-onboarding-title"
            ref={headingRef}
            tabIndex={-1}
            className="animate-rise mt-2 text-title font-semibold outline-none"
            style={{ animationDelay: "70ms" }}
            data-numeric
          >
            {done ? t("offerDone", { time }) : denied ? t("deniedTitle") : t("offerTitle")}
          </h1>
          <p className="animate-rise text-ink-soft mt-2 text-label" style={{ animationDelay: "140ms" }}>
            {denied ? prompt.deniedHow : done ? t("onboardingDoneBody") : t("offerBody")}
          </p>

          <div className="animate-rise mt-6" style={{ animationDelay: "210ms" }}>
            <ReminderPreview
              time={time}
              onTimeChange={phase === "offer" || phase === "failed" ? prompt.setTime : undefined}
              streak={streak}
            />
          </div>

          {!denied ? <PushPromises className="animate-rise mt-6" style={{ animationDelay: "280ms" }} /> : null}

          {phase === "failed" ? (
            <p role="alert" className="text-ink mt-5 text-label font-medium">
              {t("failed")}
            </p>
          ) : null}
        </div>
      </main>

      <footer
        className="bg-paper border-line shrink-0 border-t"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-md px-5 pt-3">
          {done || denied ? (
            <button
              type="button"
              onClick={onDone}
              className="bg-accent active:bg-accent-press flex min-h-14 w-full items-center justify-center gap-2 rounded-control text-body font-semibold text-white transition-colors duration-75"
            >
              {done ? <CheckIcon className="size-5" /> : null}
              {t("onboardingContinue")}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void prompt.enable()}
                disabled={phase === "busy"}
                aria-busy={phase === "busy"}
                className="bg-accent active:bg-accent-press flex min-h-14 w-full items-center justify-center rounded-control text-body font-semibold text-white transition-colors duration-75 disabled:opacity-60"
              >
                {phase === "busy" ? t("enabling") : t("offerEnable")}
              </button>
              <button
                type="button"
                onClick={skip}
                disabled={phase === "busy"}
                className="text-ink-soft mt-1 min-h-11 w-full text-label"
              >
                {t("offerLater")}
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
