import { useId, type Ref } from "react";

/**
 * Pastilka — měna aplikace.
 *
 * Jediná plná a barevná kresba v jinak obrysové sadě ikon. Je to záměr:
 * obrysové ikony jsou ovládání, pastilka je předmět, který se sbírá, a to
 * musí být poznat na první pohled. Medový kotouč s odleskem čte oko jako
 * minci, tedy jako měnu, a zároveň zůstává v lékárně — pastilka je lék
 * i bonbón.
 *
 * Tmavší obrys a jediný odlesk drží tvar i v 14 px, kde se objevuje
 * v cenovce nápovědy. Kříž na lícu je ražba, ne lékárenský znak, proto
 * je světlý a tenký. Vlastní kresba, ne Lucide.
 *
 * Přechody potřebují id a každá instance své — jinak by se na stránce
 * s několika pastilkami odkazovaly na přechod té první a po jejím
 * odmontování zmizely.
 */
export function Pastille({ className, ref }: { className?: string; ref?: Ref<SVGSVGElement> }) {
  const id = useId();
  const face = `${id}-face`;
  const inner = `${id}-inner`;

  return (
    <svg ref={ref} viewBox="0 0 48 48" aria-hidden className={className}>
      <defs>
        <radialGradient id={face} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffe3a3" />
          <stop offset="0.45" stopColor="#f7a531" />
          <stop offset="1" stopColor="#c8660b" />
        </radialGradient>
        <radialGradient id={inner} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="1" stopColor="#e5861a" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="25.5" r="18" fill="#8a3f03" opacity="0.22" />
      <circle cx="24" cy="24" r="18" fill={`url(#${face})`} stroke="#9a4b05" strokeWidth="1.6" />
      <circle
        cx="24"
        cy="24"
        r="11.5"
        fill={`url(#${inner})`}
        stroke="#b85c07"
        strokeOpacity="0.55"
        strokeWidth="1.4"
      />
      <path
        d="M18.5 24h11M24 18.5v11"
        stroke="#fff4d9"
        strokeOpacity="0.75"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <ellipse cx="16.5" cy="14.5" rx="6" ry="3.4" transform="rotate(-32 16.5 14.5)" fill="#fff" opacity="0.75" />
    </svg>
  );
}
