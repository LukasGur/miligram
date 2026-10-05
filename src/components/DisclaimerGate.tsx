"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useHydrated, useLocalValue } from "@/lib/clientState";
import { writeLocal, STORAGE_KEYS } from "@/lib/localStore";
import { PrivacyLink } from "./PrivacySheet";
import { Wordmark } from "./Wordmark";

export function DisclaimerGate({ children }: { children: ReactNode }) {
  const t = useTranslations("disclaimer");
  const hydrated = useHydrated();
  const acceptedAt = useLocalValue(STORAGE_KEYS.disclaimerAcceptedAt);

  // Krátký neutrální mezistav: než přečteme souhlas, nesmí probliknout
  // ani aplikace, ani podmínky.
  if (!hydrated) {
    return (
      <div className="bg-paper flex min-h-dvh items-center justify-center">
        <Wordmark className="text-ink-soft text-heading" />
      </div>
    );
  }

  if (acceptedAt) return <>{children}</>;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      className="bg-paper flex min-h-dvh flex-col"
      style={{
        paddingTop: "calc(var(--sa-t) + 2rem)",
        paddingBottom: "calc(var(--sa-b) + 1.5rem)",
      }}
    >
      <div className="scroll-y mx-auto flex w-full max-w-md flex-1 flex-col px-6">
        <Wordmark className="text-accent text-heading self-start" />

        <h1 id="disclaimer-title" className="mt-10 text-title font-semibold">
          {t("title")}
        </h1>
        <p className="mt-4 text-body font-medium">{t("lead")}</p>
        <p className="text-ink-soft mt-3 text-body">{t("body")}</p>
        <p className="text-ink-soft border-line mt-6 border-l-2 pl-4 text-label">{t("note")}</p>
        <PrivacyLink className="mt-4 min-h-11 self-start text-label" />
      </div>

      <div className="mx-auto w-full max-w-md px-6 pt-6">
        <button
          type="button"
          autoFocus
          onClick={() => writeLocal(STORAGE_KEYS.disclaimerAcceptedAt, new Date().toISOString())}
          className="bg-accent active:bg-accent-press min-h-14 w-full rounded-control text-body font-semibold text-on-accent"
        >
          {t("confirm")}
        </button>
      </div>
    </div>
  );
}
