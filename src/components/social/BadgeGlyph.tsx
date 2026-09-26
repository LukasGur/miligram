import type { BadgeId } from "@/core/badges";

/**
 * Odznak: štítek s ustřiženými rohy jako etiketa na ampuli, glyf jednou
 * barvou. Zamčený je šedý. Stupeň (I/II/III) sedí v rohu — jeden odznak
 * roste, místo aby vedle sebe stály tři podobné.
 *
 * Kresby glyfů jsou z Lucide (ISC), stejně jako ostatní ikony.
 */
const GLYPH: Record<BadgeId, React.ReactNode> = {
  streak: <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />,
  flawless: <path d="M20 6 9 17l-5-5" />,
  solved: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  promotion: (
    <>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </>
  ),
  topLeague: (
    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294zM5 21h14" />
  ),
  weekWinner: (
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>
  ),
  duelist: (
    <>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="m13 19 6-6" />
      <path d="m16 16 4 4" />
      <path d="m19 21 2-2" />
      <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
      <path d="m5 14 4 4" />
      <path d="m7 17-3 3" />
      <path d="m3 19 2 2" />
    </>
  ),
  graduate: (
    <>
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </>
  ),
  versatile: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  colleague: (
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  ),
};

const ROMAN = ["", "I", "II", "III"];

export function BadgeGlyph({
  id,
  level,
  levels,
  size = "md",
}: {
  id: BadgeId;
  level: number;
  levels: number;
  size?: "md" | "lg";
}) {
  const locked = level === 0;
  const big = size === "lg";
  return (
    <span
      aria-hidden
      className={`relative grid shrink-0 place-items-center ${big ? "size-16" : "size-14"} ${
        locked ? "bg-surface text-ink-soft/45" : "bg-accent-wash text-accent"
      }`}
      style={{ clipPath: "polygon(18% 0, 82% 0, 100% 18%, 100% 82%, 82% 100%, 18% 100%, 0 82%, 0 18%)" }}
    >
      <svg viewBox="0 0 24 24" className={big ? "size-7" : "size-6"}>
        <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {GLYPH[id]}
        </g>
      </svg>
      {levels > 1 ? (
        <span className="readout absolute right-1.5 bottom-1 text-[10px] leading-none font-semibold">
          {ROMAN[Math.max(level, 1)]}
        </span>
      ) : null}
    </span>
  );
}
