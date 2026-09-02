"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/i18n/LocaleProvider";
import { useLocalValue, useStandalone } from "@/lib/clientState";
import { STORAGE_KEYS } from "@/lib/localStore";
import { CheckIcon, CloseIcon } from "./icons";

const APP_VERSION = "0.1.0";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("settings");
  const tDisclaimer = useTranslations("disclaimer");
  const tLocale = useTranslations("locale");
  const tInstall = useTranslations("install");
  const { locale, setLocale, available } = useLocale();
  const standalone = useStandalone();
  const acceptedAt = useLocalValue(STORAGE_KEYS.disclaimerAcceptedAt);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const acceptedLabel = acceptedAt
    ? tDisclaimer("confirmedOn", {
        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(acceptedAt)),
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t("title")}
        onClick={onClose}
        className="bg-ink/25 absolute inset-0"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="bg-paper relative max-h-[88dvh] rounded-t-sheet"
        style={{ paddingBottom: "calc(var(--sa-b) + 1rem)" }}
      >
        <header className="border-line flex items-center justify-between border-b px-5 py-4">
          <h2 id="settings-title" className="text-heading font-semibold">
            {t("title")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("title")}
            className="text-ink-soft -mr-3 size-11 p-3"
          >
            <CloseIcon className="size-5" />
          </button>
        </header>

        <div className="scroll-y max-h-[70dvh] px-5 py-5">
          <Section title={t("language")} hint={t("languageHint")}>
            <div className="border-line divide-line divide-y rounded-control border">
              {available.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  aria-pressed={code === locale}
                  className="flex min-h-12 w-full items-center justify-between px-4 text-body"
                >
                  {tLocale(code)}
                  {code === locale ? <CheckIcon className="text-accent size-5" /> : null}
                </button>
              ))}
            </div>
          </Section>

          <Section title={t("install")}>
            <p className="text-ink-soft text-label">
              {standalone ? tInstall("installed") : tInstall("notInstalled")}
            </p>
          </Section>

          <Section title={t("storage")}>
            <p className="text-ink-soft text-label">{t("storageHint")}</p>
          </Section>

          <Section title={t("legal")}>
            <p className="text-body font-medium">{tDisclaimer("lead")}</p>
            <p className="text-ink-soft mt-2 text-label">{tDisclaimer("body")}</p>
            {acceptedLabel ? (
              <p className="text-ink-soft mt-3 text-micro" data-numeric>
                {acceptedLabel}
              </p>
            ) : null}
          </Section>

          <Section title={t("about")}>
            <p className="text-ink-soft text-label" data-numeric>
              {t("version", { version: APP_VERSION })}
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7 last:mb-0">
      <h3 className="text-ink-soft mb-2 text-micro font-semibold">{title}</h3>
      {children}
      {hint ? <p className="text-ink-soft mt-2 text-micro">{hint}</p> : null}
    </section>
  );
}
