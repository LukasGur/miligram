"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { REMINDER_EARLIEST, REMINDER_LATEST } from "@/lib/push";

/**
 * Náhled připomínky: zamčená obrazovka v malém.
 *
 * Nahoře hodiny se zvoleným časem, pod nimi notifikace, jak opravdu
 * přijde — s tou sérií, kterou student právě má. Místo výčtu „co budeme
 * posílat“ ukazuje přesně to jedno, co dostane, a kdy.
 *
 * Hodiny jsou zároveň volba času: přes číslice leží průhledné pole
 * `type="time"`, takže klepnutí otevře systémové kolečko (iOS) nebo
 * hodiny (Android). Vlastní výběr času by byl horší v obojím.
 */
export function ReminderPreview({
  time,
  onTimeChange,
  streak,
  className = "",
}: {
  time: string;
  onTimeChange?: (time: string) => void;
  streak: number;
  className?: string;
}) {
  const t = useTranslations("notifications");
  const tPush = useTranslations("push");
  const inputId = useId();

  return (
    <div
      className={`from-accent-wash to-surface relative overflow-hidden rounded-panel bg-linear-to-b px-4 pt-5 pb-4 ${className}`}
    >
      <div className="relative mx-auto flex w-fit flex-col items-center">
        <span
          aria-hidden
          className="readout text-accent text-[3.5rem] leading-none font-semibold tracking-tight"
          data-numeric
        >
          {time}
        </span>
        {onTimeChange ? (
          <>
            <label htmlFor={inputId} className="text-ink-soft mt-2 text-micro">
              {t("offerTimeHint")}
            </label>
            <input
              id={inputId}
              type="time"
              value={time}
              min={REMINDER_EARLIEST}
              max={REMINDER_LATEST}
              step={900}
              onChange={(event) => {
                if (event.target.value) onTimeChange(event.target.value);
              }}
              // Pole leží přes hodiny i nápovědu a je neviditelné: klepnutí
              // kamkoli na čas otevře systémový výběr.
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </>
        ) : null}
      </div>

      <Notice
        className="animate-notice mt-5"
        app={t("previewApp")}
        time={time}
        title={tPush(streak === 0 ? "variants.N1.title" : "variants.V1.title", { days: streak })}
        body={tPush(streak === 0 ? "variants.N1.body" : "variants.V1.body", { days: streak })}
      />
    </div>
  );
}

/**
 * Jedna notifikace, jak ji kreslí systém: ikona aplikace, název, čas,
 * tučný titulek a věta. Zaoblení a stín jsou systémové, ne naše — tady
 * se ukazuje cizí prvek, a proto smí vypadat jinak než zbytek aplikace.
 */
export function Notice({
  app,
  time,
  title,
  body,
  className = "",
}: {
  app: string;
  time: string;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`bg-paper/85 flex gap-3 rounded-[1.125rem] px-3.5 py-3 shadow-[0_10px_30px_-12px_rgb(14_17_22/0.35)] ring-1 ring-black/5 backdrop-blur ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- statický export, ikona je v precache */}
      <img src="/icons/apple-touch-icon.png" alt="" className="size-9 shrink-0 rounded-[0.5rem]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-ink-soft truncate text-micro font-semibold tracking-wide uppercase">{app}</span>
          <span className="readout text-ink-soft shrink-0 text-micro" data-numeric>
            {time}
          </span>
        </div>
        <p className="mt-0.5 text-label leading-snug font-semibold">{title}</p>
        <p className="text-ink-soft text-label leading-snug">{body}</p>
      </div>
    </div>
  );
}
