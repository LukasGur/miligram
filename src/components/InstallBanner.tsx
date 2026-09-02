"use client";

import { useTranslations } from "next-intl";
import {
  useHydrated,
  useInstallPrompt,
  usePlatform,
  useSnoozed,
  useStandalone,
} from "@/lib/clientState";
import { clearInstallPrompt } from "@/lib/pwa";
import { writeLocal, STORAGE_KEYS } from "@/lib/localStore";
import { AddToHomeIcon, CaretDownIcon, CloseIcon, ShareIosIcon } from "./icons";

/** Odmítnutí platí dva týdny — pak má smysl se zeptat znovu, ne dřív. */
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export function InstallBanner() {
  const t = useTranslations("install");
  const hydrated = useHydrated();
  const standalone = useStandalone();
  const platform = usePlatform();
  const prompt = useInstallPrompt();
  const snoozed = useSnoozed(STORAGE_KEYS.installBannerDismissedAt, SNOOZE_MS);

  const isIosSafari = platform === "ios-safari";
  const isIosOther = platform === "ios-other-browser";

  if (!hydrated || standalone || snoozed) return null;
  // Na desktopu a v prohlížečích bez instalace nemá lišta co nabídnout.
  if (!prompt && !isIosSafari && !isIosOther) return null;

  const dismiss = () => writeLocal(STORAGE_KEYS.installBannerDismissedAt, String(Date.now()));

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    clearInstallPrompt();
  };

  return (
    <aside aria-label={t("iosTitle")} className="border-line bg-paper border-t px-4 py-2.5">
      <div className="mx-auto flex w-full max-w-md items-center gap-3">
        <span className="bg-accent-wash text-accent flex size-9 shrink-0 items-center justify-center rounded-control">
          <AddToHomeIcon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold">
            {isIosSafari || isIosOther ? t("iosTitle") : t("androidTitle")}
          </p>

          {isIosOther ? (
            <p className="text-ink-soft mt-0.5 text-micro">{t("openInSafari")}</p>
          ) : isIosSafari ? (
            <ol className="text-ink-soft mt-1 flex items-center gap-1.5 text-micro">
              <li className="text-ink flex items-center gap-1">
                <ShareIosIcon className="size-3.5" />
                {t("iosStepShare")}
              </li>
              <li aria-hidden>›</li>
              <li className="text-ink flex items-center gap-1">
                <AddToHomeIcon className="size-3.5" />
                {t("iosStepAdd")}
              </li>
              {/* Ikona Sdílet je na iPhonu ve spodní liště Safari — šipka míří k ní. */}
              <li aria-hidden className="text-accent ml-0.5">
                <CaretDownIcon className="size-3.5" />
              </li>
            </ol>
          ) : (
            <p className="text-ink-soft mt-0.5 text-micro">{t("androidBody")}</p>
          )}
        </div>

        {prompt ? (
          <button
            type="button"
            onClick={() => void install()}
            className="bg-accent active:bg-accent-press min-h-11 shrink-0 rounded-control px-4 text-label font-semibold text-white"
          >
            {t("androidAction")}
          </button>
        ) : null}

        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="text-ink-soft -mr-2.5 flex size-11 shrink-0 items-center justify-center"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>
    </aside>
  );
}
