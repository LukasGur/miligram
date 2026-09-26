"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DUEL_WINDOW_MS } from "@/core/duel";

const TICKS = 8;

/**
 * Lhůta 48 hodin jako dílky stupnice. Poslední čtvrtina je medová —
 * upozornění, ne poplach; červená patří jen chybné odpovědi.
 */
export function DeadlineBar({ deadline, label, now }: { deadline: Date; label: string; now: number }) {
  const t = useTranslations("social");
  const format = useFormatter();
  const left = Math.max(deadline.getTime() - now, 0);
  const hours = Math.ceil(left / 3_600_000);
  const lit = Math.ceil((left / DUEL_WINDOW_MS) * TICKS);
  const low = left <= DUEL_WINDOW_MS / 4;

  return (
    <div>
      <div className="text-ink-soft flex justify-between text-micro">
        <span>{label}</span>
        <span data-numeric>
          {hours > 0 ? t("hoursLeft", { hours }) : t("minutesLeft", { minutes: Math.max(Math.ceil(left / 60_000), 0) })}
          <span className="sr-only"> · {format.dateTime(deadline, { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
        </span>
      </div>
      <div className="mt-1.5 flex gap-0.5" aria-hidden>
        {Array.from({ length: TICKS }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 ${index < lit ? (low ? "bg-pill" : "bg-accent") : "bg-line"}`}
          />
        ))}
      </div>
    </div>
  );
}
