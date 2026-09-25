import { useEffect, useEffectEvent, useRef } from "react";
import { Pastille } from "./Pastille";

/** Jedna pastilka v letu: odkud, kam a kdy vyrazí. */
export type Flight = { id: number; from: DOMRect; to: DOMRect; delay: number };

const SIZE = 20;

/**
 * Pastilka letí obloukem do zůstatku. Letí nad vším a mimo tok stránky,
 * takže nic neodsune. Po dopadu ji rodič odebere.
 */
export function Flyer({ flight, onLand }: { flight: Flight; onLand: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const land = useEffectEvent(onLand);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { from, to, delay, id } = flight;
    const x0 = from.left + from.width / 2 - SIZE / 2;
    const y0 = from.top + from.height / 2 - SIZE / 2;
    const x1 = to.left + to.width / 2 - SIZE / 2;
    const y1 = to.top + to.height / 2 - SIZE / 2;
    // Střídavě vlevo a vpravo od přímky, ať pastilky neletí v zástupu.
    const bend = id % 2 ? 24 : -18;
    const animation = el.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.7)`, opacity: 0 },
        {
          transform: `translate(${(x0 + x1) / 2 + bend}px, ${Math.min(y0, y1) - 24}px) scale(1.1)`,
          opacity: 1,
          offset: 0.45,
        },
        { transform: `translate(${x1}px, ${y1}px) scale(0.9)`, opacity: 1 },
      ],
      { duration: 560, delay, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "both" },
    );
    animation.onfinish = () => land();
    return () => animation.cancel();
  }, [flight]);

  return (
    <span ref={ref} className="pointer-events-none fixed top-0 left-0 z-10 size-5" aria-hidden>
      <Pastille className="size-5" />
    </span>
  );
}

/** Krátké pružné zvětšení zůstatku, když do něj něco dopadne. */
export function bump(el: HTMLElement | null): void {
  el?.animate([{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], {
    duration: 220,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  });
}

export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
