"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon } from "@/components/icons";
import type { DeviceFacts } from "@/lib/push";
import { useSession } from "@/lib/useSession";
import { PushPromises } from "./PushPromises";
import { ReminderPreview } from "./ReminderPreview";
import { usePushPrompt } from "./usePushPrompt";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

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

  if (!open) return null;

  async function enable() {
    if ((await prompt.enable()) === "done") window.setTimeout(() => setClosed(true), DONE_MS);
  }

  return (
    <BottomSheet
      onClose={later}
      scrimLabel={t("offerClose")}
      labelledBy="push-offer-title"
      initialFocus={primaryRef}
      className="px-5 pt-5"
      style={{ paddingBottom: "calc(var(--sa-b) + 1rem)" }}
    >
      <ReminderPreview
        time={time}
        onTimeChange={phase === "offer" || phase === "failed" ? prompt.setTime : undefined}
        streak={streak}
      />

      {phase === "done" ? (
        <div className="animate-tick flex min-h-40 flex-col items-center justify-center gap-3 text-center" role="status">
          <span className="bg-accent flex size-12 items-center justify-center rounded-full text-on-accent">
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
          <Button
            ref={primaryRef}
            onClick={() => setClosed(true)}
            className="mt-6 w-full"
          >
            {t("deniedOk")}
          </Button>
        </>
      ) : (
        <>
          <p className="panel-label mt-5">{t("offerLabel")}</p>
          <h2 id="push-offer-title" className="mt-1 text-title font-semibold">
            {t("offerTitle")}
          </h2>
          <p className="text-ink-soft mt-2 text-label">{t("offerBody")}</p>
          <PushPromises className="mt-4" />
          {phase === "failed" ? (
            <p role="alert" className="text-ink mt-3 text-label font-medium">
              {t("failed")}
            </p>
          ) : null}

          <Button
            ref={primaryRef}
            onClick={() => void enable()}
            disabled={phase === "busy"}
            aria-busy={phase === "busy"}
            className="mt-6 w-full"
          >
            {phase === "busy" ? t("enabling") : t("offerEnable")}
          </Button>
          <Button
            onClick={later}
            disabled={phase === "busy"}
            variant="text" tone="muted" className="mt-1 w-full"
          >
            {t("offerLater")}
          </Button>
        </>
      )}
    </BottomSheet>
  );
}
