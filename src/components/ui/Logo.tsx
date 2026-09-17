/**
 * Značka: tableta se zářezem.
 *
 * Tentýž tvar jako ikona na ploše (brand/icon.svg). V aplikaci se dosud
 * neobjevoval — bez něj je hlavička jen slovo a značka nikde.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g transform="rotate(24 12 12)">
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <rect x="10.9" y="3" width="2.2" height="18" fill="var(--color-paper)" />
      </g>
    </svg>
  );
}
