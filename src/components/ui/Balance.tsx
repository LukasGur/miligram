import type { Ref } from "react";
import { Pastille } from "./Pastille";

/**
 * Zůstatek pastilek: pastilka a číslo.
 *
 * Bez podkladu a bez rámečku. Číslo je černé jako každý jiný odečet
 * v aplikaci — barvu nese jen pastilka. Stojí v hlavičce lekce a na konci
 * lekce, kde do něj přilétá odměna.
 */
export function Balance({
  value,
  label,
  ref,
  iconRef,
}: {
  /** Zůstatek, už naformátovaný. */
  value: string;
  /** Celá věta pro odečítač. */
  label: string;
  ref?: Ref<HTMLSpanElement>;
  /** Místo, kam dopadají pastilky. */
  iconRef?: Ref<SVGSVGElement>;
}) {
  return (
    <span ref={ref} className="text-ink inline-flex min-h-11 shrink-0 items-center gap-1.5">
      <Pastille ref={iconRef} className="size-5 shrink-0" />
      <span className="readout text-body font-semibold" data-numeric aria-hidden>
        {value}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
