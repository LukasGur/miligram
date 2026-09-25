"use client";

import { useTranslations } from "next-intl";
import {
  useHydrated,
  useInstallPrompt,
  usePlatform,
  useSnoozed,
  useStandalone,
} from "@/lib/clientState";
import { clearInstallPrompt, type Platform } from "@/lib/pwa";
import { writeLocal, STORAGE_KEYS } from "@/lib/localStore";
import { AddToHomeIcon, CaretDownIcon, CloseIcon, MenuDotsIcon, ShareIosIcon } from "./icons";

/** Odmítnutí platí dva týdny — pak má smysl se zeptat znovu, ne dřív. */
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Co jde na tomhle zařízení nabídnout k instalaci. Nic, když aplikace
 * už běží z plochy, nebo na desktopu a v prohlížeči bez instalace.
 * Sdílí to lišta s nastavením, kde se postup najde i po zavření lišty.
 */
export function useInstallOffer() {
  const hydrated = useHydrated();
  const standalone = useStandalone();
  const platform = usePlatform();
  const prompt = useInstallPrompt();

  const isIos = platform === "ios-safari" || platform === "ios-other-browser";
  const isAndroid = platform === "android";

  if (!hydrated || standalone) return null;
  if (!prompt && !isIos && !isAndroid) return null;

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    clearInstallPrompt();
  };

  return { prompt, platform, install };
}

/** Ruční postup: Sdílet (iPhone) nebo Nabídka (Android) › Přidat na plochu. */
export function InstallSteps({ platform, className = "text-micro" }: { platform: Platform; className?: string }) {
  const t = useTranslations("install");
  const isIos = platform === "ios-safari" || platform === "ios-other-browser";

  return (
    <ol className={`text-ink-soft flex items-center gap-1.5 ${className}`}>
      <li className="text-ink flex items-center gap-1">
        {isIos ? <ShareIosIcon className="size-3.5" /> : <MenuDotsIcon className="size-3.5" />}
        {isIos ? t("stepShare") : t("stepMenu")}
      </li>
      <li aria-hidden>›</li>
      <li className="text-ink flex items-center gap-1">
        <AddToHomeIcon className="size-3.5" />
        {t("stepAdd")}
      </li>
      {/* Ikona Sdílet je v Safari na iPhonu ve spodní liště — šipka míří k ní.
          Jinde (Chrome, Edge na iOS, nabídka na Androidu) je nahoře. */}
      {platform === "ios-safari" ? (
        <li aria-hidden className="text-accent ml-0.5">
          <CaretDownIcon className="size-3.5" />
        </li>
      ) : null}
    </ol>
  );
}

/**
 * Nabídka přidání na plochu.
 *
 * Kde prohlížeč nabídne vlastní instalaci (`beforeinstallprompt`), stačí
 * tlačítko. Safari to neumí nikdy a na Androidu to není jisté — Firefox
 * událost nevyšle vůbec a Chrome ne vždy, třeba po dřívějším odmítnutí.
 * Tam lišta ukáže ruční postup. Na Androidu obecný: položka se v každém
 * prohlížeči jmenuje trochu jinak, ale vždycky je v nabídce pod třemi
 * tečkami a obsahuje „na plochu“ nebo „nainstalovat“.
 */
export function InstallBanner() {
  const t = useTranslations("install");
  const offer = useInstallOffer();
  const snoozed = useSnoozed(STORAGE_KEYS.installBannerDismissedAt, SNOOZE_MS);

  if (!offer || snoozed) return null;
  const { prompt, install } = offer;

  const dismiss = () => writeLocal(STORAGE_KEYS.installBannerDismissedAt, String(Date.now()));

  const title = prompt ? t("installTitle") : t("addTitle");

  return (
    <aside aria-label={title} className="border-line bg-paper border-t px-4 py-2.5">
      <div className="mx-auto flex w-full max-w-md items-center gap-3">
        <span className="bg-accent-wash text-accent flex size-9 shrink-0 items-center justify-center rounded-control">
          <AddToHomeIcon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold">{title}</p>

          {prompt ? (
            <p className="text-ink-soft mt-0.5 text-micro">{t("installBody")}</p>
          ) : (
            <InstallSteps platform={offer.platform} className="mt-1 text-micro" />
          )}
        </div>

        {prompt ? (
          <button
            type="button"
            onClick={() => void install()}
            className="bg-accent active:bg-accent-press min-h-11 shrink-0 rounded-control px-4 text-label font-semibold text-white"
          >
            {t("installAction")}
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
