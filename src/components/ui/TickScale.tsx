/**
 * Stupnice postupu.
 *
 * Ne pruh, ale dílky — jako graduace na stříkačce. Je to jediný motiv,
 * který aplikace přebírá z toho, o čem je, a zároveň nese informaci
 * navíc oproti pruhu: je vidět, kolik příkladů zbývá, ne jen podíl.
 */
export function TickScale({
  total,
  done,
  current,
  label,
}: {
  total: number;
  /** Kolik dílků je hotových. */
  done: number;
  /** Index právě rozdělaného dílku, je-li jaký. */
  current?: number;
  label: string;
}) {
  return (
    <div
      className="flex h-4 flex-1 items-end gap-[3px]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      {Array.from({ length: total }, (_, index) => {
        const filled = index < done;
        const active = index === current;
        return (
          <span
            key={index}
            className={`flex-1 rounded-[1px] transition-[height,background-color] duration-200 ${
              filled ? "bg-accent h-4" : active ? "bg-accent/35 h-4" : "bg-line h-2"
            }`}
          />
        );
      })}
    </div>
  );
}
