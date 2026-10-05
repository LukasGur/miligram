"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { CloseIcon } from "./icons";

/** Oddíly zásad v pořadí, v jakém se čtou; texty jsou v `privacy.<oddíl>Title/Body`. */
const SECTIONS = ["who", "without", "what", "why", "see", "where", "howLong", "rights"] as const;

/**
 * Odkaz na zásady ochrany osobních údajů. List si nese s sebou, takže
 * jde vložit kamkoli: do přihlášení, nastavení i úvodního upozornění.
 */
export function PrivacyLink({ className = "", children }: { className?: string; children?: ReactNode }) {
  const t = useTranslations("privacy");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`text-accent font-medium ${className}`}>
        {children ?? t("link")}
      </button>
      {open ? <PrivacySheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PrivacySheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("privacy");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    // Ve fázi zachycení a bez dalšího šíření: Escape zavře jen zásady,
    // ne i nastavení pod nimi.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  // Do body, ne na místo odkazu. V nastavení by list ležel v rolovací
  // oblasti a iOS Safari by jeho `fixed` vztáhl k ní: vrstva zásad pak
  // překryla hlavičku nastavení a křížek, vidět byl, ale nešel stisknout.
  // Nad nastavením (z-50), odkud se taky otevírá.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end text-left">
      <button type="button" aria-label={t("close")} onClick={onClose} className="animate-scrim bg-scrim absolute inset-0" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        className="animate-sheet bg-paper relative mx-auto w-full max-w-md rounded-t-sheet"
        style={{ paddingBottom: "calc(var(--sa-b) + 1rem)" }}
      >
        <div className="border-line flex items-center justify-between border-b px-5 py-4">
          <h2 id="privacy-title" className="text-heading font-semibold">
            {t("title")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="text-ink-soft -mr-3 size-11 p-3"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
        <div tabIndex={0} className="scroll-y max-h-[75dvh] px-5 py-5">
          {SECTIONS.map((section) => (
            <section key={section} className="mb-6">
              <h3 className="panel-label mb-2">{t(`${section}Title`)}</h3>
              <p className="text-body">{t(`${section}Body`)}</p>
            </section>
          ))}
          <p className="text-ink-soft text-micro" data-numeric>
            {t("updated")}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
