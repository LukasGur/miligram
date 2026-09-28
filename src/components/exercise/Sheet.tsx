"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

/**
 * List pomůcky během počítání: vzor, nápověda. Vyjede zespodu přes
 * příklad a zavře se křížkem, klepnutím vedle nebo Escapem — rozepsaná
 * odpověď pod ním zůstává. Obě pomůcky se otevírají stejně, aby se
 * člověk neučil dvě gesta pro jednu věc.
 *
 * `footer` stojí pod rolovaným obsahem pevně, v dosahu palce — patří
 * sem akce, ke které se v listu sahá opakovaně.
 */
export function Sheet({
  id,
  title,
  aside,
  closeLabel,
  onClose,
  footer,
  children,
}: {
  id: string;
  title: string;
  /** Drobnost vedle nadpisu, třeba počítadlo kroků. */
  aside?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const safeBottom = "calc(var(--sa-b) + 1.25rem)";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        tabIndex={-1}
        aria-label={closeLabel}
        onClick={onClose}
        className="animate-scrim bg-ink/25 absolute inset-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="animate-sheet bg-paper relative mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-sheet"
      >
        <div className="border-line flex shrink-0 items-center gap-3 border-b py-2 pr-2 pl-5">
          <h2 id={id} className="flex-1 text-heading font-semibold">
            {title}
          </h2>
          {aside}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="text-ink-soft flex size-11 items-center justify-center"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
        <div
          className="scroll-y px-5 pt-4"
          style={{ paddingBottom: footer ? "1.25rem" : safeBottom }}
          tabIndex={0}
        >
          {children}
        </div>
        {footer ? (
          <div className="border-line shrink-0 border-t px-5 pt-3" style={{ paddingBottom: safeBottom }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
