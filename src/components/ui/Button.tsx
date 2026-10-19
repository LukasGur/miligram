import type { ComponentProps } from "react";
import { pressable } from "@/lib/press";

/**
 * Tlačítko celé aplikace. Stisk nese `pressable`, ne `:active` — na iOS
 * se `:active` při krátkém ťuknutí často vůbec neukáže (src/lib/press.ts).
 *
 * Výška podle místa: `lg` (56 px) je hlavní akce dole na obrazovce,
 * `md` (48 px) tlačítko uvnitř karty, seznamu nebo listu. Textové
 * tlačítko má vždy 44 px, víc by v řádku textu překáželo.
 *
 * Rozložení (šířka, okraje, mezera mezi ikonou a textem u textového
 * tlačítka) dodává volající přes `className`. Třídy, které tady už jsou,
 * se nepřepisují: v Tailwindu rozhoduje pořadí v CSS, ne v atributu.
 */
export function Button({
  variant = "primary",
  size = "lg",
  tone = "accent",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "text";
  /** Jen u plného a obrysového tlačítka. */
  size?: "lg" | "md";
  /** Barva obrysového a textového tlačítka; plné je vždy v akcentu. */
  tone?: "accent" | "muted";
}) {
  return (
    <button
      type={type}
      {...pressable}
      {...props}
      className={`press press-wide inline-flex items-center justify-center disabled:opacity-40 ${LOOK[variant](size, tone)} ${className}`}
    />
  );
}

const HEIGHT = { lg: "min-h-14", md: "min-h-12" } as const;

const LOOK = {
  primary: (size: "lg" | "md") =>
    `bg-accent data-pressed:bg-accent-press text-on-accent ${HEIGHT[size]} gap-2 rounded-control px-4 text-body font-semibold`,
  secondary: (size: "lg" | "md", tone: "accent" | "muted") =>
    `${
      tone === "accent"
        ? "bg-paper text-accent border-accent/20 data-pressed:bg-accent-wash-press"
        : "border-line text-ink data-pressed:border-surface-press data-pressed:bg-surface-press"
    } ${HEIGHT[size]} gap-2 rounded-control border px-3 text-body font-medium`,
  text: (_size: "lg" | "md", tone: "accent" | "muted") =>
    `${
      tone === "accent" ? "text-accent data-pressed:text-accent-press" : "text-ink-soft data-pressed:text-ink"
    } min-h-11 text-label font-medium`,
} as const;
