"use client";

import { NextIntlClientProvider } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocalValue } from "@/lib/clientState";
import { writeLocal, STORAGE_KEYS } from "@/lib/localStore";
import { defaultLocale, detectLocale, isLocale, locales, messages, type Locale } from "./locales";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  available: readonly Locale[];
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  /**
   * Uložená volba má přednost před jazykem prohlížeče. Statický export
   * se prerenderuje v češtině; po hydrataci se hodnota dorovná bez
   * hydratačního rozdílu, protože jde o externí zdroj (useSyncExternalStore).
   */
  const stored = useLocalValue(STORAGE_KEYS.locale);
  const locale: Locale = isLocale(stored)
    ? stored
    : typeof navigator === "undefined"
      ? defaultLocale
      : detectLocale(navigator.languages ?? [navigator.language]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => writeLocal(STORAGE_KEYS.locale, next), []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, available: locales }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="Europe/Prague">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale musí být uvnitř LocaleProvider.");
  return context;
}
