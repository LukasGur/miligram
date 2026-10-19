"use client";

import { useEffect, useEffectEvent, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/** Otevřené listy odspodu nahoru. Escape zavře jen ten nejvýš. */
const stack: symbol[] = [];

/**
 * Spodní list: pozadí, vyjetí, zavření Escapem a fokus po otevření.
 * Co je v listu (hlavička, křížek, tlačítka), patří volajícímu.
 *
 * Fokus jde na `initialFocus`, jinak na list sám — odečítač pak začne
 * nadpisem a za listem nezůstane.
 */
export function BottomSheet({
  onClose,
  scrimLabel,
  role = "dialog",
  labelledBy,
  describedBy,
  initialFocus,
  layer = "base",
  className = "",
  style,
  children,
}: {
  /** Escape a klepnutí na pozadí. */
  onClose: () => void;
  /** Popisek pozadí. Bez něj pozadí list nezavře: potvrzení, které chce odpověď. */
  scrimLabel?: string;
  role?: "dialog" | "alertdialog";
  labelledBy: string;
  describedBy?: string;
  initialFocus?: RefObject<HTMLElement | null>;
  /**
   * `top` je list otevřený z jiného listu. Jde do body, ne na místo odkazu:
   * uvnitř rolovací oblasti by iOS Safari vztáhl `fixed` k ní a vrstva by
   * překryla křížek listu pod ní.
   */
  layer?: "base" | "top";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const close = useEffectEvent(onClose);

  useEffect(() => {
    (initialFocus?.current ?? sheetRef.current)?.focus({ preventScroll: true });
    const me = Symbol();
    stack.push(me);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && stack.at(-1) === me) close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      stack.splice(stack.indexOf(me), 1);
      document.removeEventListener("keydown", onKeyDown);
    };
    // Fokus jen při otevření, ne při každém překreslení.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sheet = (
    <div className={`fixed inset-0 flex flex-col justify-end ${layer === "top" ? "z-[60]" : "z-50"}`}>
      {scrimLabel ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={scrimLabel}
          onClick={onClose}
          className="animate-scrim bg-scrim absolute inset-0"
        />
      ) : (
        <div aria-hidden="true" className="animate-scrim bg-scrim absolute inset-0" />
      )}
      <div
        ref={sheetRef}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`animate-sheet bg-paper scroll-y relative mx-auto max-h-[92dvh] w-full max-w-md rounded-t-sheet outline-none ${className}`}
        style={style}
      >
        {children}
      </div>
    </div>
  );

  return layer === "top" ? createPortal(sheet, document.body) : sheet;
}
