"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/i18n/LocaleProvider";
import { useLocalValue } from "@/lib/clientState";
import { STORAGE_KEYS } from "@/lib/localStore";
import { CheckIcon, CloseIcon } from "./icons";
import { InstallSteps, useInstallOffer } from "./InstallBanner";
import { PushSettings } from "./push/PushSettings";
import { PrivacyLink } from "./PrivacySheet";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

const APP_VERSION = "0.1.0";

export function SettingsSheet({
  open,
  onClose,
  onOpenAccount,
}: {
  open: boolean;
  onClose: () => void;
  onOpenAccount: () => void;
}) {
  const t = useTranslations("settings");
  const tNotifications = useTranslations("notifications");
  const tDisclaimer = useTranslations("disclaimer");
  const tLocale = useTranslations("locale");
  const tInstall = useTranslations("install");
  const { locale, setLocale, available } = useLocale();
  const installOffer = useInstallOffer();
  const acceptedAt = useLocalValue(STORAGE_KEYS.disclaimerAcceptedAt);
  const closeRef = useRef<HTMLButtonElement>(null);

  if (!open) return null;

  const acceptedLabel = acceptedAt
    ? tDisclaimer("confirmedOn", {
        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(acceptedAt)),
      })
    : null;

  return (
    <BottomSheet
      onClose={onClose}
      scrimLabel={t("title")}
      labelledBy="settings-title"
      initialFocus={closeRef}
      style={{ paddingBottom: "calc(var(--sa-b) + 1rem)" }}
    >
      {/* Ne <header>: ten by se počítal jako druhá hlavička stránky vedle
          té na domovské obrazovce. Dialog má vlastní popis přes aria. */}
      <div className="border-line flex items-center justify-between border-b px-5 py-4">
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
      </div>

      <div tabIndex={0} className="scroll-y max-h-[70dvh] px-5 py-5">
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

        <Section title={tNotifications("settingsTitle")}>
          <PushSettings
            onSignIn={() => {
              onClose();
              onOpenAccount();
            }}
          />
        </Section>

        {/* Jen v prohlížeči: z plochy není co nabízet. Lišta se po zavření
            na dva týdny schová, tady je postup k nalezení pořád. */}
        {installOffer ? (
          <Section title={t("install")}>
            {installOffer.prompt ? (
              <>
                <p className="text-ink-soft text-label">{tInstall("installBody")}</p>
                <Button
                  onClick={() => void installOffer.install()}
                  size="md" className="mt-3"
                >
                  {tInstall("installAction")}
                </Button>
              </>
            ) : (
              <>
                <p className="text-ink-soft text-label">{tInstall("installBody")}</p>
                <InstallSteps platform={installOffer.platform} className="mt-2 text-label" />
              </>
            )}
          </Section>
        ) : null}

        <Section title={t("legal")}>
          <p className="text-body font-medium">{tDisclaimer("lead")}</p>
          <p className="text-ink-soft mt-2 text-label">{tDisclaimer("body")}</p>
          {acceptedLabel ? (
            <p className="text-ink-soft mt-3 text-micro" data-numeric>
              {acceptedLabel}
            </p>
          ) : null}
          <PrivacyLink className="mt-2 min-h-11 text-label" />
        </Section>

        <Section title={t("about")}>
          <p className="text-ink-soft readout text-label" data-numeric>
            {t("version", { version: APP_VERSION })}
          </p>
        </Section>
      </div>
    </BottomSheet>
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
      <h3 className="panel-label mb-2">{title}</h3>
      {children}
      {hint ? <p className="text-ink-soft mt-2 text-micro">{hint}</p> : null}
    </section>
  );
}
