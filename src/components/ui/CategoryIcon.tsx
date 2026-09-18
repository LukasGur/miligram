import type { Category } from "@/core/types";

/**
 * Ikony látky.
 *
 * Kreslí to, co se v kategorii počítá — stříkačku, infuzní vak, ledvinu —,
 * ne dekoraci. Drží se stejného tvaru jako zbytek sady: obrys, žádná
 * výplň, jedna tloušťka tahu, barva z `currentColor`. Ikona nikdy nestojí
 * sama, vždycky vedle názvu, takže nemusí nést význam bez popisku.
 */
type IconProps = { className?: string };

const STROKE = {
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Glyph({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <g {...STROKE}>{children}</g>
    </svg>
  );
}

/** Převody jednotek: tam a zpátky. */
function Prevody(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 9h13" />
      <path d="M14 6l3 3-3 3" />
      <path d="M20 15H7" />
      <path d="M10 18l-3-3 3-3" />
    </Glyph>
  );
}

/** Základní dávkování: tableta s dělicí rýhou. */
function Zaklad(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16" />
    </Glyph>
  );
}

/** Ředění: odměrný válec s hladinou. */
function Redeni(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M8 3h8" />
      <path d="M9 3v14a3 3 0 0 0 6 0V3" />
      <path d="M9 13h6" />
      <path d="M15 7h1.5" />
      <path d="M15 10h1.5" />
    </Glyph>
  );
}

/** Dávkování podle hmotnosti: váha. */
function Hmotnost(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 5v14" />
      <path d="M7 20h10" />
      <path d="M4 8h16" />
      <path d="M4 8l-2 5a2.6 2.6 0 0 0 4 0z" />
      <path d="M20 8l2 5a2.6 2.6 0 0 1-4 0z" />
    </Glyph>
  );
}

/** Pediatrie: malá postava. */
function Pediatrie(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="7" r="3" />
      <path d="M7 20v-3a5 5 0 0 1 10 0v3" />
    </Glyph>
  );
}

/** Rekonstituce: lahvička s uzávěrem. */
function Rekonstituce(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9 3h6" />
      <path d="M10 3v3l-1 2v11a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V8l-1-2V3" />
      <path d="M9 13h6" />
    </Glyph>
  );
}

/** Rychlost infuze: vak a kapka. */
function Infuze(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M8 3h8v9a4 4 0 0 1-8 0z" />
      <path d="M12 16v3" />
      <path d="M12 21.5c-.9 0-1.5-.7-1.5-1.5S12 18 12 18s1.5 1.2 1.5 2-.6 1.5-1.5 1.5z" />
    </Glyph>
  );
}

/** Vazoaktivní perfuzory: stříkačka v dávkovači. */
function Vazoaktivni(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M18.5 2.5 21.5 5.5" />
      <path d="M20.5 4.5 16.5 8.5" />
      <path d="M16.5 8.5 7 18l-3.5 1 1-3.5z" />
      <path d="M13 8l3 3" />
      <path d="M10.5 10.5l3 3" />
    </Glyph>
  );
}

/** Renální dávkování: ledvina. */
function Renalni(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M13.8 3.6C9.3 3.6 6 7.3 6 12s3.3 8.4 7.8 8.4c2 0 3.4-1.2 3.4-2.7 0-2.4-3.6-2.5-3.6-5.7s3.6-3.3 3.6-5.7c0-1.5-1.4-2.7-3.4-2.7z" />
      <path d="M13.6 12h2.2" />
    </Glyph>
  );
}

/** Inzulin: pero s dávkovacím okénkem. */
function Inzulin(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9 2.8h6a1 1 0 0 1 1 1V15a2.5 2.5 0 0 1-2.5 2.5h-3A2.5 2.5 0 0 1 8 15V3.8a1 1 0 0 1 1-1z" />
      <path d="M10.4 6.4h3.2v2.6h-3.2z" />
      <path d="M12 17.5V21" />
    </Glyph>
  );
}

/** Povrch těla: plocha s úhlopříčkou. */
function Povrch(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M3.5 20.5 20.5 3.5" />
      <path d="M7 16.5h3" />
      <path d="M14 7.5h3" />
    </Glyph>
  );
}

/** Onkologie: dělící se buňka. */
function Onkologie(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="8.5" cy="12" r="5.5" />
      <circle cx="15.5" cy="12" r="5.5" />
      <circle cx="8.5" cy="12" r="1.4" />
      <circle cx="15.5" cy="12" r="1.4" />
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
  renalni: Renalni,
  inzulin: Inzulin,
  povrch: Povrch,
  onkologie: Onkologie,
};

export function CategoryIcon({ category, className }: IconProps & { category: Category }) {
  const Glyf = GLYPHS[category];
  return <Glyf className={className} />;
}
