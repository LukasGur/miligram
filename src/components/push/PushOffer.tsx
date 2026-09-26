"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon } from "@/components/icons";
import type { DeviceFacts } from "@/lib/push";
import { useSession } from "@/lib/useSession";
import { ReminderPreview } from "./ReminderPreview";
import { usePushPrompt } from "./usePushPrompt";

/** Až doběhne odměna ve shrnutí — nabídka nesmí přebít radost z lekce. */
const APPEAR_AFTER_MS = 1600;
/** Jak dlouho zůstane potvrzení, než se list sám zavře. */
const DONE_MS = 1800;

/**
 * Nabídka připomínek po dohrané lekci.
 *
 * Záloha pro toho, kdo krok po registraci přeskočil (PushOnboarding).
 * Systémový dotaz na povolení přijde až po klepnutí na „Zapnout“, nikdy
 * sám od sebe: kdo ho dostane bez vysvětlení, odmítne, a odmítnutí se
 * na iOS ani v Chromu z aplikace vrátit nedá. Proto nejdřív náhled toho,
 * co přijde, a teprve pak otázka.
 */
export function PushOffer({ streak, facts }: { streak: number; facts: DeviceFacts }) {
  const t = useTranslations("notifications");
  const { session } = useSession();
  const prompt = usePushPrompt(session?.user.id, facts);
  const { phase, time } = prompt;

  const [due, setDue] = useState(false);
  const [closed, setClosed] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Jakmile se na nabídku klepne, zůstává otevřená, i když se mezitím
  // změní stav, podle kterého se nabízela (po zapnutí už „nesplňuje“).
  const open = due && !closed && (phase !== "offer" || (prompt.possible && prompt.welcome));

  function later() {
    prompt.dismiss();
    setClosed(true);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDue(true), APPEAR_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    primaryRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") later();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  if (!open) return null;

  async function enable() {
    if ((await prompt.enable()) === "done") window.setTimeout(() => setClosed(true), DONE_MS);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t("offerClose")}
        onClick={later}
        className="animate-scrim bg-ink/25 absolute inset-0"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-offer-title"
        className="animate-sheet bg-paper relative mx-auto w-full max-w-md rounded-t-sheet px-5 pt-5"
        style={{ paddingBottom: "calc(var(--sa-b) + 1rem)" }}
      >
        <ReminderPreview
          time={time}
          onTimeChange={phase === "offer" || phase === "failed" ? prompt.setTime : undefined}
          streak={streak}
        />

        {phase === "done" ? (
          <div className="animate-tick flex min-h-40 flex-col items-center justify-center gap-3 text-center" role="status">
            <span className="bg-accent flex size-12 items-center justify-center rounded-full text-white">
              <CheckIcon className="size-6" />
            </span>
            <p id="push-offer-title" className="text-heading font-semibold" data-numeric>
              {t("offerDone", { time })}
            </p>
          </div>
        ) : phase === "denied" ? (
          <>
            <h2 id="push-offer-title" className="mt-5 text-title font-semibold">
              {t("deniedTitle")}
            </h2>
            <p className="text-ink-soft mt-2 text-label">{prompt.deniedHow}</p>
            <button
              ref={primaryRef}
              type="button"
              onClick={() => setClosed(true)}
              className="bg-accent active:bg-accent-press mt-6 min-h-14 w-full rounded-control text-body font-semibold text-white"
            >
              {t("deniedOk")}
            </button>
          </>
        ) : (
          <>
            <p className="panel-label mt-5">{t("offerLabel")}</p>
            <h2 id="push-offer-title" className="mt-1 text-title font-semibold">
              {t("offerTitle")}
            </h2>
            <p className="text-ink-soft mt-2 text-label">{t("offerBody")}</p>
            {phase === "failed" ? (
              <p role="alert" className="text-ink mt-3 text-label font-medium">
                {t("failed")}
              </p>
            ) : null}

            <button
              ref={primaryRef}
              type="button"
              onClick={() => void enable()}
              disabled={phase === "busy"}
              aria-busy={phase === "busy"}
              className="bg-accent active:bg-accent-press mt-6 flex min-h-14 w-full items-center justify-center rounded-control text-body font-semibold text-white transition-opacity disabled:opacity-60"
            >
              {phase === "busy" ? t("enabling") : t("offerEnable")}
            </button>
            <button
              type="button"
              onClick={later}
              disabled={phase === "busy"}
              className="text-ink-soft mt-1 min-h-11 w-full text-label"
            >
              {t("offerLater")}
            </button>
            <p className="text-ink-soft mt-1 text-center text-micro">{t("offerFoot")}</p>
          </>
        )}
      </div>
    </div>
  );
}
