import type { Category } from "@/core/types";

/**
 * Ikony látky.
 *
 * Kresby pocházejí z knihovny Lucide (licence ISC) a jsou sem opsané,
 * stejně jako u ikon rozhraní — původ je zapsaný v docs/zdroje.md. Ledvinu
 * Lucide nemá, ta je dokreslená na téže mřížce a se stejnou tloušťkou tahu,
 * aby v seznamu stupňů nevyčnívala.
 *
 * Ikona nikdy nestojí sama, vždycky vedle názvu, takže nemusí nést význam
 * bez popisku.
 */
type IconProps = { className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Glyph({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g {...STROKE}>{children}</g>
    </svg>
  );
}


/** Převody jednotek: tam a zpátky. */
function Prevody(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </Glyph>
  );
}

/** Základní dávkování: tableta. */
function Zaklad(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </Glyph>
  );
}

/** Ředění: odměrný válec. */
function Redeni(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4.5 3h15" />
      <path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" />
      <path d="M6 14h12" />
    </Glyph>
  );
}

/** Dávkování podle hmotnosti: váha. */
function Hmotnost(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3v18" />
      <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
      <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
      <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
      <path d="M7 21h10" />
    </Glyph>
  );
}

/** Pediatrie: dítě. */
function Pediatrie(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
      <path d="M15 12h.01" />
      <path d="M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
      <path d="M9 12h.01" />
    </Glyph>
  );
}

/** Rekonstituce: rozpouštění prášku. */
function Rekonstituce(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
      <path d="M6.453 15h11.094" />
      <path d="M8.5 2h7" />
    </Glyph>
  );
}

/** Rychlost infuze: infuzní vak. */
function Infuze(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 18v2a2 2 0 002 2h6" />
      <path d="M6 11c.72.5 1.44 1 3 1 3 0 3-2 6-2 1.56 0 2.28.5 3 1" />
      <path d="M9.293 3c.453 0 .887-.18 1.207-.5s.754-.5 1.207-.5h.586c.453 0 .887.18 1.207.5s.754.5 1.207.5H16a2 2 0 012 2v11a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </Glyph>
  );
}

/** Vazoaktivní léky: oběh. */
function Vazoaktivni(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
      <path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </Glyph>
  );
}

/** Inzulin: injekce. */
function Inzulin(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m18 2 4 4" />
      <path d="m17 7 3-3" />
      <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" />
      <path d="m9 11 4 4" />
      <path d="m5 19-3 3" />
      <path d="m14 4 6 6" />
    </Glyph>
  );
}

/** Povrch těla: měření. */
function Povrch(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
      <path d="m14.5 12.5 2-2" />
      <path d="m11.5 9.5 2-2" />
      <path d="m8.5 6.5 2-2" />
      <path d="m17.5 15.5 2-2" />
    </Glyph>
  );
}

/** Onkologie: stužka. */
function Onkologie(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 11.22C11 9.997 10 9 10 8a2 2 0 0 1 4 0c0 1-.998 2.002-2.01 3.22" />
      <path d="m12 18 2.57-3.5" />
      <path d="M6.243 9.016a7 7 0 0 1 11.507-.009" />
      <path d="M9.35 14.53 12 11.22" />
      <path d="M9.35 14.53C7.728 12.246 6 10.221 6 7a6 5 0 0 1 12 0c-.005 3.22-1.778 5.235-3.43 7.5l3.557 4.527a1 1 0 0 1-.203 1.43l-1.894 1.36a1 1 0 0 1-1.384-.215L12 18l-2.679 3.593a1 1 0 0 1-1.39.213l-1.865-1.353a1 1 0 0 1-.203-1.422z" />
    </Glyph>
  );
}

/** Renální dávkování: ledvina. Lucide ji nemá, tahle je dokreslená. */
function Renalni(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M14 3c-4.4 0-8 4-8 9s3.6 9 8 9c2 0 3.3-1.3 3.3-2.9 0-2.6-3.6-2.7-3.6-6.1s3.6-3.5 3.6-6.1C17.3 4.3 16 3 14 3Z" />
      <path d="M13.8 12H16" />
    </Glyph>
  );
}

const GLYPHS: Record<Category, (props: IconProps) => React.JSX.Element> = {
  prevody: Prevody,
  zaklad: Zaklad,
  redeni: Redeni,
  hmotnost: Hmotnost,
  pediatrie: Pediatrie,
  rekonstituce: Rekonstituce,
  infuze: Infuze,
  vazoaktivni: Vazoaktivni,
  inzulin: Inzulin,
  povrch: Povrch,
  onkologie: Onkologie,
  renalni: Renalni,
};

export function CategoryIcon({ category, className }: IconProps & { category: Category }) {
  const Glyf = GLYPHS[category];
  return <Glyf className={className} />;
}
