"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon } from "@/components/icons";
import { refreshScreen } from "@/lib/refresh";

/**
 * Potažení dolů obnoví obrazovku.
 *
 * Aplikace na ploše iPhonu nemá adresní řádek ani systémové potažení
 * a po probuzení z pozadí ukazovala stará čísla (u kamaráda „0 XP“ po
 * dohrané lekci) nebo visela na načítání. Jediná cesta ven byl restart.
 *
 * Obnovit jde obrazovka, jejíž rolovací plocha nese `data-refresh` s adresou
 * pro přenačtení (`/?open=account`). Lekce ho nemá: tam by potažení jen
 * překáželo počítání.
 *
 * Indikátor je tableta z loga. Tah kreslí její obrys, na prahu se vyplní
 * a naskočí rýha, po puštění se točí, dokud obnova neskončí. Modrá, ne
 * medová: medová tableta je pastilka, tedy měna.
 *
 * Kreslí se přímo do DOMu, ne přes stav Reactu: tah posílá událost
 * každý snímek a překreslování obrazovky by ho zadrhávalo.
 */
const THRESHOLD = 72;
/** Kde obsah drží, než obnova doběhne. */
const HOLD = 56;
const INDICATOR = 30;

/** Odpor gumy: první centimetry jdou lehce, dál čím dál tížeji. */
function resist(raw: number): number {
  return raw <= 0 ? 0 : 120 * (1 - Math.exp(-raw / 160)) + raw * 0.08;
}

type Drag = {
  scroller: HTMLElement;
  startX: number;
  startY: number;
  /** null: ještě se neví, jestli jde o potažení, nebo o posun do strany. */
  pulling: boolean | null;
  distance: number;
};

export function PullToRefresh() {
  const t = useTranslations("common");
  const indicator = useRef<SVGSVGElement>(null);
  const stroke = useRef<SVGCircleElement>(null);
  const [toast, setToast] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const svg = indicator.current;
    const draw = stroke.current;
    if (!svg || !draw) return;

    let drag: Drag | null = null;
    let busy = false;
    let toastTimer: number | undefined;

    const contentOf = (scroller: HTMLElement) => Array.from(scroller.children) as HTMLElement[];

    const move = (scroller: HTMLElement, distance: number, animate: boolean) => {
      // Vlastnost `translate`, ne `transform`: obsah má vlastní nástupní
      // animace přes transform a ta by posun přebila.
      for (const child of contentOf(scroller)) {
        child.style.transition = animate ? "translate 420ms var(--ease-decel)" : "";
        child.style.translate = distance > 0 ? `0 ${distance}px` : "";
      }
    };

    const place = (scroller: HTMLElement) => {
      const box = scroller.getBoundingClientRect();
      svg.style.top = `${box.top + (HOLD - INDICATOR) / 2}px`;
      svg.style.left = `${box.left + box.width / 2 - INDICATOR / 2}px`;
      return box;
    };

    const paint = (distance: number) => {
      const progress = Math.min(distance / THRESHOLD, 1);
      draw.style.strokeDasharray = `${progress * 100} 100`;
      svg.style.opacity = String(Math.min(distance / 24, 1));
      svg.style.transform = `rotate(${progress * 200}deg) scale(${0.6 + 0.4 * progress})`;
      svg.dataset.armed = progress >= 1 ? "true" : "false";
    };

    const hide = () => {
      svg.style.opacity = "0";
      svg.dataset.spin = "false";
      svg.dataset.armed = "false";
    };

    const start = (event: TouchEvent) => {
      if (busy || event.touches.length !== 1) return;
      const target = event.target instanceof Element ? event.target : null;
      // Vysouvací panely mají vlastní rolování a zavírají se tahem dolů.
      if (!target || target.closest("[role=dialog]")) return;
      const scroller = target.closest<HTMLElement>("[data-refresh]");
      if (!scroller || scroller.scrollTop > 0) return;
      const touch = event.touches[0];
      drag = { scroller, startX: touch.clientX, startY: touch.clientY, pulling: null, distance: 0 };
    };

    const track = (event: TouchEvent) => {
      if (!drag || busy) return;
      const touch = event.touches[0];
      const dx = touch.clientX - drag.startX;
      const dy = touch.clientY - drag.startY;
      if (drag.pulling === null) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        drag.pulling = dy > 0 && Math.abs(dy) > Math.abs(dx) && drag.scroller.scrollTop <= 0;
        if (!drag.pulling) {
          drag = null;
          return;
        }
        place(drag.scroller);
        svg.dataset.spin = "false";
      }
      // Bez toho by iOS pod potažením pružil celou plochou.
      event.preventDefault();
      drag.distance = resist(dy);
      move(drag.scroller, drag.distance, false);
      paint(drag.distance);
    };

    const finish = () => {
      const current = drag;
      drag = null;
      if (!current?.pulling) return;
      const { scroller } = current;
      if (current.distance < THRESHOLD) {
        move(scroller, 0, true);
        paint(0);
        hide();
        return;
      }

      busy = true;
      move(scroller, HOLD, true);
      svg.style.transform = "";
      svg.style.opacity = "1";
      svg.dataset.armed = "true";
      svg.dataset.spin = "true";
      void refreshScreen(scroller.dataset.refresh || "/").then((outcome) => {
        // Aplikace se přenačítá: kolečko se točí, dokud stránka neodejde.
        if (outcome === "reloading") return;
        move(scroller, 0, true);
        hide();
        const box = scroller.getBoundingClientRect();
        setToast({ top: box.top + 14, left: box.left + box.width / 2 });
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => setToast(null), 1400);
        busy = false;
      });
    };

    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", track, { passive: false });
    document.addEventListener("touchend", finish);
    document.addEventListener("touchcancel", finish);
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", track);
      document.removeEventListener("touchend", finish);
      document.removeEventListener("touchcancel", finish);
      window.clearTimeout(toastTimer);
    };
  }, []);

  return (
    <>
      <svg
        ref={indicator}
        viewBox="0 0 24 24"
        aria-hidden
        className="pull-indicator pointer-events-none fixed z-30"
        style={{ width: INDICATOR, height: INDICATOR, opacity: 0, top: 0, left: 0 }}
      >
        <g transform="rotate(24 12 12)">
          <circle cx="12" cy="12" r="9" fill="none" stroke="var(--color-line)" strokeWidth="2" />
          <circle
            ref={stroke}
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="0 100"
            transform="rotate(-90 12 12)"
          />
          <circle className="pull-indicator-body" cx="12" cy="12" r="10" fill="var(--color-accent)" />
          <line className="pull-indicator-groove" x1="12" y1="4.6" x2="12" y2="19.4" stroke="var(--color-paper)" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      </svg>
      <div role="status" aria-live="polite" className="pointer-events-none">
        {toast ? (
          <p
            className="animate-tick text-ink-soft fixed z-30 flex -translate-x-1/2 items-center gap-1.5 text-label font-medium"
            style={{ top: toast.top, left: toast.left }}
          >
            <CheckIcon className="size-3.5" />
            {t("refreshed")}
          </p>
        ) : null}
      </div>
    </>
  );
}
