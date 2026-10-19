"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/Spinner";
import { RefreshIcon } from "@/components/icons";
import { holdWaiting } from "@/lib/refresh";
import { reloadTo } from "@/lib/screenLoad";
import { Button } from "@/components/ui/Button";

/**
 * „Načítám“, které nezůstane viset navždy.
 *
 * Po probuzení z pozadí iOS nechá viset spojení, a profil pak ukazoval
 * načítání, dokud člověk aplikaci nezavřel. Běžné načtení trvá pod dvě
 * sekundy; po osmi už je jasné, že samo nedoběhne, a místo čekání přijde
 * vysvětlení a tlačítko, které aplikaci přenačte rovnou sem.
 *
 * Dokud je vidět, obnova potažením (src/lib/refresh.ts) ví, že obrazovka
 * visí, a přenačte aplikaci, i když se žádný dotaz nezasekl.
 *
 * `screen`: celá obrazovka (kód obrazovky se stahuje), jinak řádek
 * v obsahu. `compact`: obrazovka má vlastní spodní lištu, tlačítko proto
 * zůstane v obsahu.
 */
const STUCK_AFTER_MS = 8_000;

export function StuckLoading({
  target,
  onBack,
  screen = false,
  compact = false,
}: {
  target: string;
  onBack?: () => void;
  screen?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("common");
  const [stuck, setStuck] = useState(false);

  useEffect(() => holdWaiting(), []);
  useEffect(() => {
    const timer = window.setTimeout(() => setStuck(true), STUCK_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Člověk o přenačtení požádal sám, pojistka proti smyčce tu neplatí.
  const reload = () => {
    if (!reloadTo(target)) window.location.replace(target);
  };

  if (!stuck) {
    return (
      <div
        role="status"
        className={`text-ink-soft flex items-center gap-2.5 text-label ${
          screen ? "bg-paper h-dvh justify-center" : "mt-2"
        }`}
      >
        <Spinner className="size-4" />
        {t("loading")}
      </div>
    );
  }

  const message = (
    <div role="alert" className="animate-rise">
      <p className="text-heading font-semibold">{t("stuckTitle")}</p>
      <p className="text-ink-soft mt-1.5 text-label">{t("stuckBody")}</p>
    </div>
  );

  if (compact) {
    return (
      <div className="mt-2">
        {message}
        <Button
          onClick={reload}
          variant="text" className="-ml-1 mt-2 gap-2 px-1"
        >
          <RefreshIcon className="size-4" />
          {t("stuckReload")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className={screen ? "bg-paper mx-auto flex h-dvh w-full max-w-md flex-col justify-center px-5" : "mt-2"}>
        {message}
      </div>
      {/* Akce ve spodní třetině, kam dosáhne palec, stejně jako lišta lekce. */}
      <footer
        className="bg-paper border-line animate-rise fixed inset-x-0 bottom-0 z-20 border-t"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-md px-5 pt-3">
          <Button
            onClick={reload}
            className="w-full"
          >
            <RefreshIcon className="size-5" />
            {t("stuckReload")}
          </Button>
          {onBack ? (
            <Button
              onClick={onBack}
              variant="text" tone="muted" className="mt-1 w-full"
            >
              {t("back")}
            </Button>
          ) : null}
        </div>
      </footer>
    </>
  );
}
