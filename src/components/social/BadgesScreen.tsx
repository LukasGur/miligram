"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { BadgeState } from "@/core/badges";
import { BadgeGlyph } from "./BadgeGlyph";
import { BadgeSheet } from "./BadgeSheet";
import { Screen } from "./Screen";

/**
 * Odznaky. Neodemčený ukazuje podmínku a kolik chybí — cíl, ne výčitku.
 * Klepnutí otevře detail se všemi stupni.
 */
export function BadgesScreen({ badges, onBack }: { badges: BadgeState[] | undefined; onBack: () => void }) {
  const t = useTranslations("social");
  const format = useFormatter();
  const unlocked = badges?.filter((badge) => badge.level > 0).length ?? 0;
  const [open, setOpen] = useState<BadgeState | null>(null);

  return (
    <Screen
      title={t("badgesTitle")}
      onBack={onBack}
      aside={
        <span className="readout text-ink-soft mr-3 text-label" data-numeric>
          {t("badgesCount", { unlocked, total: badges?.length ?? 10 })}
        </span>
      }
    >
      <ul className="mt-2 grid grid-cols-3 gap-x-2 gap-y-6">
        {(badges ?? []).map((badge) => (
          <li key={badge.id}>
            <button
              type="button"
              onClick={() => setOpen(badge)}
              className="group flex w-full flex-col items-center gap-1.5 text-center"
            >
              <span className="transition-transform duration-150 group-active:scale-94">
                <BadgeGlyph id={badge.id} level={badge.level} levels={badge.levels} size="lg" />
              </span>
              <span className={`text-label leading-tight ${badge.level > 0 ? "font-semibold" : "text-ink-soft"}`}>
                {t(`badge.${badge.id}.name`)}
              </span>
              <span className="text-ink-soft text-micro leading-snug" data-numeric>
                {t(`badge.${badge.id}.rule`, {
                  level: Math.min(badge.level + 1, badge.levels),
                })}
              </span>
              {badge.progress ? (
                <>
                  <span className="bg-line relative h-1 w-14" aria-hidden>
                    <span
                      className="bg-accent absolute inset-y-0 left-0"
                      style={{
                        width: `${Math.min((badge.progress.value / badge.progress.target) * 100, 100)}%`,
                      }}
                    />
                  </span>
                  <span className="readout text-ink-soft text-[0.6875rem]" data-numeric>
                    {format.number(badge.progress.value)} / {format.number(badge.progress.target)}
                  </span>
                </>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {open ? <BadgeSheet badge={open} onClose={() => setOpen(null)} /> : null}
    </Screen>
  );
}
