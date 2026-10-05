"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * Záchrana pro jakýkoli pád obrazovky. Bez ní React po chybě zahodil celý
 * strom, zbyla bílá plocha a pomohl jen restart aplikace.
 *
 * Tlačítko aplikaci přenačte, ne jen znovu vykreslí (`retry`): typická
 * příčina je kód, který se nestáhl, a ten se opakovaným vykreslením
 * nespraví. Data leží v IndexedDB, přenačtení o ně nepřijde.
 */
export default function Error({ error }: { error: Error & { digest?: string } }) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-paper flex h-dvh flex-col px-5" style={{ paddingBottom: "calc(var(--sa-b, 0px) + 1.5rem)" }}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end">
        <h1 className="text-heading font-semibold">{t("crashTitle")}</h1>
        <p className="text-ink-soft mt-1.5 text-label">{t("crashBody")}</p>
        <button
          type="button"
          onClick={() => window.location.replace("/")}
          className="bg-accent active:bg-accent-press mt-6 min-h-12 w-full rounded-control text-body font-semibold text-on-accent"
        >
          {t("crashReload")}
        </button>
      </div>
    </div>
  );
}
