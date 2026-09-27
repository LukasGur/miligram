/**
 * Odesílá se. Kroužek s obloukem, barvu bere z textu kolem. Kdo má
 * omezený pohyb, vidí stojící oblouk — i ten říká „pracuje se“ a tlačítko
 * je vedle toho zašedlé.
 */
export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`shrink-0 motion-safe:animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={2.5} opacity={0.25} />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}
