"use client";

import { useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/BottomSheet";

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
  const safeBottom = "calc(var(--sa-b) + 1.25rem)";

  return (
    <BottomSheet onClose={onClose} scrimLabel={closeLabel} labelledBy={id} initialFocus={closeRef} className="flex flex-col">
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
    </BottomSheet>
  );
}
