import { initials, toneOf } from "@/core/monogram";
import { LeagueInsignia } from "./LeagueInsignia";

/**
 * Monogram místo fotky. Tón se odvozuje z přezdívky (src/core/monogram.ts),
 * takže kamarád má všude stejnou barvu. Třídy jsou vypsané doslova —
 * Tailwind skládané názvy tříd nenajde.
 */
const TONE_CLASS = [
  "bg-tone-0",
  "bg-tone-1",
  "bg-tone-2",
  "bg-tone-3",
  "bg-tone-4",
  "bg-tone-5",
  "bg-tone-6",
  "bg-tone-7",
] as const;

const SIZE = {
  sm: "size-8 rounded-[0.375rem] text-micro",
  md: "size-12 rounded-control text-body",
  lg: "size-[4.75rem] rounded-control text-[1.75rem] tracking-tight",
} as const;

export function Monogram({
  handle,
  size = "md",
  /** Vnitřní číslo ligy (1 nejnižší). Odznak se připne do rohu. */
  tier,
  className = "",
}: {
  handle: string;
  size?: keyof typeof SIZE;
  tier?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center font-semibold text-white ${SIZE[size]} ${TONE_CLASS[toneOf(handle)]} ${className}`}
    >
      {initials(handle)}
      {tier !== undefined ? (
        <LeagueInsignia tier={tier} className="bg-paper border-line absolute -right-2.5 -bottom-2 border" />
      ) : null}
    </span>
  );
}
