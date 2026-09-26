import { TOP_TIER } from "@/core/league";

/**
 * Odznak ligy: pět stoupajících sloupků jako síla signálu. Rozsvícených
 * je tolik, kolik lig je pod tebou včetně tvé — 5. liga jeden, 1. liga
 * všech pět. Číslo ligy se čte obráceně (1. je nejvyšší), sloupky rostou
 * s postupem, takže se to nedá splést.
 *
 * `fresh` dorůstá nejvyšší rozsvícený sloupek: postup na konci týdne.
 */
export function LeagueInsignia({
  tier,
  size = "sm",
  muted = false,
  fresh = false,
  className = "",
}: {
  /** Vnitřní číslo (1 nejnižší, TOP_TIER nejvyšší). */
  tier: number;
  size?: "sm" | "lg";
  muted?: boolean;
  fresh?: boolean;
  className?: string;
}) {
  const big = size === "lg";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-end rounded-[4px] ${
        big ? "h-14 gap-1.5 p-2" : "h-[1.375rem] gap-[2px] p-[3px]"
      } ${muted ? "text-ink-soft/55" : "text-accent"} ${className}`}
    >
      {Array.from({ length: TOP_TIER }, (_, index) => (
        <span
          key={index}
          className={`block rounded-[1px] bg-current ${big ? "w-2.5" : "w-[3px]"} ${index < tier ? "" : "opacity-20"} ${
            fresh && index === tier - 1 ? "stripe-grow" : ""
          }`}
          style={{ height: `${36 + index * 16}%` }}
        />
      ))}
    </span>
  );
}
