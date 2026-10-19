"use client";

import { useId, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CheckIcon } from "@/components/icons";
import type { BadgeState } from "@/core/badges";
import { BadgeGlyph, ROMAN } from "./BadgeGlyph";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

/**
 * Detail odznaku: velký štítek, název a žebřík stupňů. Hotové stupně mají
 * fajfku, ten další ukazuje, kolik chybí, vzdálenější jsou ztlumené —
 * student vidí, kam odznak roste, ne jen jeho příští krok.
 *
 * U kamaráda (`withProgress` vypnuté) jen stupně a podmínky. Kolik mu
 * chybí, je jeho věc.
 */
export function BadgeSheet({
  badge,
  withProgress = true,
  onClose,
}: {
  badge: BadgeState;
  withProgress?: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("social");
  const format = useFormatter();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  const tiered = badge.levels > 1;
  const status =
    badge.level === 0
      ? t("badgeLocked")
      : tiered
        ? t("badgeLevelOf", { level: badge.level, levels: badge.levels })
        : t("badgeEarned");
  const progress = withProgress ? badge.progress : null;

  return (
    <BottomSheet
      onClose={onClose}
      scrimLabel={t("close")}
      labelledBy={titleId}
      initialFocus={closeRef}
      className="px-5 pt-7"
      style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
    >
      <div className="flex flex-col items-center text-center">
        <BadgeGlyph id={badge.id} level={badge.level} levels={badge.levels} size="xl" />
        <h2 id={titleId} className="mt-4 text-title font-semibold">
          {t(`badge.${badge.id}.name`)}
        </h2>
        <p className={`mt-1 text-label ${badge.level > 0 ? "text-accent font-semibold" : "text-ink-soft"}`} data-numeric>
          {status}
        </p>
      </div>

      <ol className="mt-6">
        {Array.from({ length: badge.levels }, (_, index) => {
          const step = index + 1;
          const done = step <= badge.level;
          const next = step === badge.level + 1;
          const last = step === badge.levels;
          const rule = t(`badge.${badge.id}.rule`, { level: step });
          return (
            <li key={step} className="flex gap-3.5">
              {/* Značka a spojnice k dalšímu stupni: žebřík, po kterém se leze. */}
              <span className="flex w-7 shrink-0 flex-col items-center" aria-hidden>
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full ${
                    done
                      ? "bg-accent text-on-accent"
                      : next
                        ? "border-accent border-2"
                        : "border-line border-2"
                  }`}
                >
                  {done ? <CheckIcon className="size-3.5" /> : null}
                </span>
                {last ? null : <span className={`my-1 w-0.5 flex-1 ${done ? "bg-accent" : "bg-line"}`} />}
              </span>

              <div className={`min-w-0 flex-1 ${last ? "" : "pb-4"}`}>
                <p className="flex min-h-7 items-center gap-2.5">
                  {tiered ? (
                    <span
                      className={`readout w-6 shrink-0 text-label font-semibold ${
                        done || next ? "text-ink" : "text-ink-soft"
                      }`}
                    >
                      {ROMAN[step]}
                    </span>
                  ) : null}
                  <span
                    className={`text-body leading-snug ${
                      done ? "text-ink" : next ? "text-ink font-medium" : "text-ink-soft"
                    }`}
                    data-numeric
                  >
                    {rule}
                  </span>
                  {done ? <span className="sr-only">{t("badgeDone")}</span> : null}
                </p>

                {next && progress ? (
                  <div className={`mt-2 flex items-center gap-3 ${tiered ? "pl-8.5" : ""}`}>
                    <span
                      role="progressbar"
                      aria-label={rule}
                      aria-valuemin={0}
                      aria-valuemax={progress.target}
                      aria-valuenow={progress.value}
                      className="bg-line relative h-1.5 flex-1 overflow-hidden"
                    >
                      <span
                        className="bg-accent absolute inset-y-0 left-0"
                        style={{ width: `${Math.min((progress.value / progress.target) * 100, 100)}%` }}
                      />
                    </span>
                    <span className="readout text-ink-soft shrink-0 text-label" data-numeric>
                      {format.number(progress.value)} / {format.number(progress.target)}
                    </span>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <Button ref={closeRef} onClick={onClose} variant="secondary" tone="muted" className="mt-7 w-full">
        {t("close")}
      </Button>
    </BottomSheet>
  );
}
