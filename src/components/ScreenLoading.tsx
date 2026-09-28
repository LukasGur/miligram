"use client";

import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Místo obrazovky, jejíž kód se ještě stahuje. Dřív tu nebylo nic a po
 * zaseknutém stažení zůstala bílá plocha, o které nešlo poznat, jestli
 * aplikace ještě žije.
 */
export function ScreenLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="bg-paper text-ink-soft flex h-dvh items-center justify-center gap-2.5 text-label">
      <Spinner />
      {t("loading")}
    </div>
  );
}
