import type { Ref } from "react";

/**
 * Pastilka — měna aplikace.
 *
 * Táž kresba jako logo: tableta s dělicí rýhou pootočená o 24°. Liší se
 * jen barvou — logo je indigo, pastilka med. Plochá, bez lesku a stínu,
 * jako všechno ostatní v aplikaci; od obrysových ikon ji odlišuje plná
 * výplň, takže je poznat, že je to věc, ne ovládání.
 *
 * Tmavší okraj drží tvar na bílé i v 14 px v cenovce nápovědy — samotná
 * medová plocha by proti papíru neměla dost kontrastu.
 */
export function Pastille({ className, ref }: { className?: string; ref?: Ref<SVGSVGElement> }) {
  return (
    <svg ref={ref} viewBox="0 0 24 24" aria-hidden className={className}>
      <g transform="rotate(24 12 12)">
        <circle cx="12" cy="12" r="9" fill="#f2a93b" stroke="#b8650f" strokeWidth="1.25" />
        <rect x="11.1" y="3.6" width="1.8" height="16.8" fill="var(--color-paper)" opacity="0.9" />
      </g>
    </svg>
  );
}
