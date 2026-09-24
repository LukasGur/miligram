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
import { AddToHomeIcon, CaretDownIcon, CloseIcon, MenuDotsIcon, ShareIosIcon } from "./icons";

/** Odmítnutí platí dva týdny — pak má smysl se zeptat znovu, ne dřív. */
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

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
  const hydrated = useHydrated();
  const standalone = useStandalone();
  const platform = usePlatform();
  const prompt = useInstallPrompt();
  const snoozed = useSnoozed(STORAGE_KEYS.installBannerDismissedAt, SNOOZE_MS);

  const isIos = platform === "ios-safari" || platform === "ios-other-browser";
  const isAndroid = platform === "android";

  if (!hydrated || standalone || snoozed) return null;
  // Na desktopu a v prohlížečích bez instalace nemá lišta co nabídnout.
  if (!prompt && !isIos && !isAndroid) return null;

  const dismiss = () => writeLocal(STORAGE_KEYS.installBannerDismissedAt, String(Date.now()));

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    clearInstallPrompt();
  };

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
            <ol className="text-ink-soft mt-1 flex items-center gap-1.5 text-micro">
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
