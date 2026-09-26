import { initials, resolveTone } from "@/core/monogram";
import { useChosenTone } from "@/lib/tones";
import { LeagueInsignia } from "./LeagueInsignia";

/**
 * Monogram místo fotky: kruh v jemném tónu a iniciály v tmavém odstínu
 * téhož tónu. Kruh je člověk — ovládací prvky mají rohy, lidé ne.
 *
 * Tón si člověk vybere v profilu; kdo si nevybral, má ten z přezdívky
 * (src/core/monogram.ts). Vybrané tóny zná src/lib/tones.ts. Třídy jsou
 * vypsané doslova — Tailwind skládané názvy tříd nenajde.
 */
const TONE_CLASS = [
  "bg-tone-0-wash text-tone-0",
  "bg-tone-1-wash text-tone-1",
  "bg-tone-2-wash text-tone-2",
  "bg-tone-3-wash text-tone-3",
  "bg-tone-4-wash text-tone-4",
  "bg-tone-5-wash text-tone-5",
  "bg-tone-6-wash text-tone-6",
  "bg-tone-7-wash text-tone-7",
] as const;

const SIZE = {
  xs: "size-7 text-[0.625rem] tracking-[0.02em]",
  sm: "size-8 text-[0.6875rem] tracking-[0.02em]",
  md: "size-12 text-[0.9375rem] tracking-[0.01em]",
  lg: "size-[4.75rem] text-[1.625rem] tracking-tight",
} as const;

export function Monogram({
  handle,
  size = "md",
  /** Vnitřní číslo ligy (1 nejnižší). Odznak se připne do rohu. */
  tier,
  /** Tón k náhledu při výběru. Jinak vybraný, nebo ten z přezdívky. */
  tone,
  className = "",
}: {
  handle: string;
  size?: keyof typeof SIZE;
  tier?: number;
  tone?: number;
  className?: string;
}) {
  const chosen = useChosenTone(handle);
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition-colors duration-200 shadow-[inset_0_0_0_1px_color-mix(in_oklab,currentColor_14%,transparent)] ${SIZE[size]} ${TONE_CLASS[resolveTone(handle, tone ?? chosen)]} ${className}`}
    >
      {initials(handle)}
      {tier !== undefined ? (
        <LeagueInsignia tier={tier} className="bg-paper border-line absolute -right-1.5 -bottom-1 border" />
      ) : null}
    </span>
  );
}
