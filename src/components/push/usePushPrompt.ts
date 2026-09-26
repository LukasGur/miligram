"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/i18n/LocaleProvider";
import { useLocalValue, usePlatform, useSnoozed } from "@/lib/clientState";
import { STORAGE_KEYS, writeLocal } from "@/lib/localStore";
import {
  DEFAULT_PREFS,
  enablePush,
  pushOnFor,
  showWelcomeNotice,
  usePushStatus,
  type DeviceFacts,
} from "@/lib/push";
import { supabase } from "@/lib/supabase";

/** Odmítnutá nabídka se vrátí nejdřív za týden… */
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
/** …a po třetím odmítnutí už ne. Vypínač v Nastavení zůstává. */
const MAX_DISMISSALS = 3;

export type PromptPhase = "offer" | "busy" | "done" | "denied" | "failed";

/**
 * Společný základ nabídek upozornění — listu po lekci a kroku po
 * registraci. Obě se musí chovat stejně: stejné podmínky, stejné
 * počítání odmítnutí, stejné zapnutí. Liší se jen tím, jak vypadají.
 */
export function usePushPrompt(userId: string | undefined, facts: DeviceFacts) {
  const t = useTranslations("notifications");
  const { locale } = useLocale();
  const status = usePushStatus();
  const platform = usePlatform();
  const snoozed = useSnoozed(STORAGE_KEYS.pushOfferDismissedAt, SNOOZE_MS);
  const dismissals = Number(useLocalValue(STORAGE_KEYS.pushOfferDismissals) ?? 0) || 0;

  const [phase, setPhase] = useState<PromptPhase>("offer");
  const [time, setTime] = useState(DEFAULT_PREFS.reminderTime);

  /** Dá se upozornění na tomhle zařízení vůbec zapnout? */
  const possible =
    Boolean(userId) &&
    status.ready &&
    status.availability === "available" &&
    status.permission !== "denied" &&
    !pushOnFor(status, userId);

  /** Smí se nabídnout znovu po předchozím odmítnutí? */
  const welcome = !snoozed && dismissals < MAX_DISMISSALS;

  /** Odmítnutí nabídky. Počítá se, jen když ji uživatel opravdu viděl. */
  function dismiss() {
    if (phase !== "offer") return;
    writeLocal(STORAGE_KEYS.pushOfferDismissedAt, String(Date.now()));
    writeLocal(STORAGE_KEYS.pushOfferDismissals, String(dismissals + 1));
  }

  /**
   * Zapnutí. Musí běžet přímo z klepnutí: iOS dotaz na povolení jinak
   * neukáže, proto před ním není nic, na co by se čekalo.
   */
  async function enable(): Promise<PromptPhase> {
    const client = supabase();
    if (!client || !userId) return "failed";
    setPhase("busy");
    const result = await enablePush(client, userId, { reminderTime: time, locale, ...facts });
    if (result === "enabled") {
      await showWelcomeNotice(t("welcomeTitle"), t("welcomeBody", { time }));
      setPhase("done");
      return "done";
    }
    setPhase(result);
    return result;
  }

  const deniedHow =
    platform === "ios-safari" || platform === "ios-other-browser"
      ? t("deniedIos")
      : platform === "android"
        ? t("deniedAndroid")
        : t("deniedDesktop");

  return { phase, time, setTime, possible, welcome, dismiss, enable, deniedHow };
}
