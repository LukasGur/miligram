import type { ReactNode } from "react";
import { Pastille } from "./Pastille";

/**
 * Cenovka s pastilkou: med na medovém podkladu. Táž jako cena nápovědy,
 * takže pastilky vypadají všude stejně — ať se platí, nebo přibývají.
 * Bonus za účet stojí v cenovce, ne ve větě: věta „a ještě dostaneš…“
 * zní, jako by se přemlouvalo.
 */
export function PillTag({ children }: { children: ReactNode }) {
  return (
    <span className="bg-pill-wash text-pill inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2 font-semibold">
      <Pastille className="size-4" />
      {children}
    </span>
  );
}
