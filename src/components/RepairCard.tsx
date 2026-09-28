"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CheckIcon, RepeatIcon } from "@/components/icons";
import { Pastille } from "@/components/ui/Pastille";
import { localDay, REPAIR_COST } from "@/core/economy";
import { useLocalValue } from "@/lib/clientState";
import { STORAGE_KEYS, writeLocal } from "@/lib/localStore";
import { pressable } from "@/lib/press";
import { repairStreak, useRepairOffer } from "@/lib/repair";
import { useProfile } from "@/lib/useProfile";

/** Jak dlouho zůstane potvrzení po obnovení, než karta zmizí. */
const DONE_MS = 4000;

/**
 * Nabídka obnovit spadlou sérii.
 *
 * Objeví se jen krátce po ztrátě a jen u série aspoň týden dlouhé
 * (repairOffer v src/core/economy.ts). Je nahoře, nad denním cílem:
 * lhůta běží a zítra už může být pozdě. Nekřičí — žádná červená, žádný
 * odpočet; ztracená série není chyba, jen škoda.
 *
 * Tlačítko ukazuje cenu vždycky, i když na ni nezbývá. Po klepnutí řekne,
 * kolik chybí — zašedlé tlačítko by neřeklo proč.
 */
export function RepairCard() {
  const t = useTranslations("home");
  const format = useFormatter();
  const offer = useRepairOffer();
  const { profile } = useProfile();
  const dismissed = useLocalValue(STORAGE_KEYS.repairDismissed);
  const [busy, setBusy] = useState(false);
  const [poor, setPoor] = useState(false);
  const [done, setDone] = useState<"today" | "later" | null>(null);

  useEffect(() => {
    if (done === null) return;
    const timer = window.setTimeout(() => setDone(null), DONE_MS);
    return () => window.clearTimeout(timer);
  }, [done]);

  if (done) {
    return (
      <p role="status" className="animate-tick text-accent mt-4 flex items-center gap-2 text-label font-semibold">
        <CheckIcon className="size-5 shrink-0" />
        {done === "today" ? t("repairDoneToday") : t("repairDone")}
      </p>
    );
  }

  if (!offer || dismissed === offer.missing[0]) return null;

  async function repair() {
    if (!offer || busy) return;
    setBusy(true);
    const result = await repairStreak(offer);
    setBusy(false);
    if (result === "poor") {
      setPoor(true);
      return;
    }
    // Obnovení po dnešní lekci sérii rovnou spojí; jinak ji prodlouží až lekce.
    setDone(profile.lastLessonDay === localDay() ? "today" : "later");
  }

  return (
    <section
      aria-labelledby="repair-title"
      className="animate-rise bg-paper border-line mt-4 rounded-panel border p-4 shadow-sm"
    >
      <div className="flex gap-3">
        <span className="bg-pill-wash text-pill flex size-10 shrink-0 items-center justify-center rounded-full">
          <RepeatIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="repair-title" className="text-body font-semibold" data-numeric>
            {t("repairTitle", { days: offer.lost })}
          </h2>
          <p className="text-ink-soft mt-0.5 text-label">
            {t("repairBody", { when: offer.until === localDay() ? "today" : "later" })}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void repair()}
        disabled={busy}
        aria-busy={busy}
        {...pressable}
        className="press press-wide bg-accent data-pressed:bg-accent-press mt-3.5 flex min-h-12 w-full items-center justify-between rounded-control px-4 text-body font-semibold text-white disabled:opacity-60"
      >
        <span>{t("repairAction")}</span>
        <span className="readout inline-flex items-center gap-1.5" data-numeric>
          <Pastille className="size-5 shrink-0" />
          <span aria-hidden>{format.number(REPAIR_COST)}</span>
          <span className="sr-only">{t("repairPrice", { cost: REPAIR_COST })}</span>
        </span>
      </button>

      {poor ? (
        <p role="status" className="text-ink mt-2 text-label">
          {t("repairPoor", { missing: Math.max(0, REPAIR_COST - profile.pills) })}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => writeLocal(STORAGE_KEYS.repairDismissed, offer.missing[0])}
        className="text-ink-soft mt-1 min-h-11 w-full text-label"
      >
        {t("repairDismiss")}
      </button>
    </section>
  );
}
