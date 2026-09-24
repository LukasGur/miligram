type IconProps = { className?: string };

/**
 * Ikony rozhraní.
 *
 * Kresby pocházejí z knihovny Lucide (licence ISC) a jsou sem opsané, ne
 * dotažené jako závislost: do balíku se tím nedostane nic, co se
 * nepoužívá, a domovská obrazovka má na kilobajty nárok. Původ je zapsaný
 * v docs/zdroje.md.
 *
 * Všechny sdílejí jeden tvar: mřížka 24×24, žádná výplň, tah 2 a kulaté
 * konce. Barvu berou z `currentColor`, takže je nastavuje text kolem nich.
 */
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g {...STROKE}>{children}</g>
    </svg>
  );
}


/**
 * Sdílení na iOS. Vlastní kresba: systémový symbol je součást rozhraní
 * Apple a v Lucide obdobu nemá — tady musí sedět přesně, protože se jím
 * ukazuje cesta k instalaci.
 */
export function ShareIosIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    </Icon>
  );
}


/** Nabídka prohlížeče na Androidu (tři svislé tečky). */
export function MenuDotsIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </Icon>
  );
}

export function AddToHomeIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </Icon>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M10 5H3" />
      <path d="M12 19H3" />
      <path d="M14 3v4" />
      <path d="M16 17v4" />
      <path d="M21 12h-9" />
      <path d="M21 19h-5" />
      <path d="M21 5h-7" />
      <path d="M8 10v4" />
      <path d="M8 12H3" />
    </Icon>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function CaretDownIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </Icon>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function BackspaceIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <path d="m12 9 6 6" />
      <path d="m18 9-6 6" />
    </Icon>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </Icon>
  );
}

export function PersonIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M5 21v-6" />
      <path d="M12 21V3" />
      <path d="M19 21V9" />
    </Icon>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

export function PillIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </Icon>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Icon>
  );
}

export function RepeatIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </Icon>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <path d="M16 3.128a4 4 0 0 1 0 7.744" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
    </Icon>
  );
}

export function VersusIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m13 19 6-6" />
      <path d="M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5" />
      <path d="m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586" />
      <path d="m16 16 4 4" />
      <path d="m19 21 2-2" />
      <path d="m5 14 4 4" />
      <path d="m5 21-2-2" />
      <path d="M7.5 16.5 4 20" />
    </Icon>
  );
}

export function LadderIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M5 21v-6" />
      <path d="M12 21V9" />
      <path d="M19 21V3" />
    </Icon>
  );
}

export function CalculatorIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="16" x2="16" y1="14" y2="18" />
      <path d="M16 10h.01" />
      <path d="M12 10h.01" />
      <path d="M8 10h.01" />
      <path d="M12 14h.01" />
      <path d="M8 14h.01" />
      <path d="M12 18h.01" />
      <path d="M8 18h.01" />
    </Icon>
  );
}

export function HintIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </Icon>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

/** Zdroje údajů — kniha, ne „info“: jde o to, odkud číslo pochází. */
export function BookIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </Icon>
  );
}

/** Odkaz ven z aplikace. */
export function ArrowUpRightIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </Icon>
  );
}

export function LogOutIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </Icon>
  );
}
