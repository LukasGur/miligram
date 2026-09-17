/**
 * Kruh denního cíle.
 *
 * Ukazuje, kolik příkladů z dnešní lekce je hotových. Kruh proto, že
 * na jeden pohled řekne „skoro" nebo „ještě ne" bez čtení čísla —
 * a číslo je uvnitř pro toho, kdo ho chce přesně.
 */
export function ProgressRing({
  done,
  total,
  size = 116,
  children,
}: {
  done: number;
  total: number;
  size?: number;
  children: React.ReactNode;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total === 0 ? 0 : Math.min(done / total, 1);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-500 ease-[var(--ease-decel)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
