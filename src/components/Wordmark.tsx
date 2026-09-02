/** Slovní značka aplikace. Velikost a barvu určuje volající. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-[-0.03em] ${className ?? ""}`}>Miligram</span>
  );
}
