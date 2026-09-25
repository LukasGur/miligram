import type { Ref } from "react";
import { Pastille } from "./Pastille";

/**
 * Peněženka: pastilka a zůstatek v kulatém čipu.
 *
 * Stojí vpravo v hlavičce, kde se zůstatek v aplikacích hledá. Dřív byl
 * zůstatek řádek „Zásoby“ uprostřed obrazovky a vypadal jako položka
 * nastavení. Na domovské obrazovce je to tlačítko do obchodu, na konci
 * lekce jen cíl, do kterého přiletí odměna.
 */
export function Wallet({
  value,
  label,
  onClick,
  ref,
  iconRef,
}: {
  /** Zůstatek, už naformátovaný. */
  value: string;
  /** Celá věta pro odečítač: počet a co se po klepnutí stane. */
  label: string;
  onClick?: () => void;
  ref?: Ref<HTMLElement>;
  /** Místo, kam dopadají pastilky z odměny. */
  iconRef?: Ref<SVGSVGElement>;
}) {
  const body = (
    <>
      <Pastille ref={iconRef} className="size-6 shrink-0" />
      <span className="readout text-body font-semibold" data-numeric aria-hidden>
        {value}
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
  const shape =
    "bg-pill-wash text-pill inline-flex h-9 items-center gap-1.5 rounded-full pl-1.5 pr-3";

  if (!onClick) {
    return (
      <span ref={ref as Ref<HTMLSpanElement>} className={shape}>
        {body}
      </span>
    );
  }

  // Čip je 36 px vysoký, ale sahá se na 44: přesah dělá okraj kolem.
  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center"
    >
      <span className={shape}>{body}</span>
    </button>
  );
}
