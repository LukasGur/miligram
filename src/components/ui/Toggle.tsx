/**
 * Řádek s přepínačem. Celý řádek je sahací cíl, ne jen jezdec —
 * palcem se do 48 px širokého jezdce na kraji obrazovky trefuje špatně.
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  hint,
  children,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex min-h-12 w-full items-center justify-between gap-4 px-4 py-2 text-left text-body disabled:opacity-40 ${className}`}
    >
      <span className="min-w-0">
        <span className="block">{children}</span>
        {hint ? <span className="text-ink-soft mt-0.5 block text-micro">{hint}</span> : null}
      </span>
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-accent" : "bg-surface-press"
        }`}
      >
        <span
          className={`bg-paper absolute top-0.5 left-0.5 size-6 rounded-full shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}
