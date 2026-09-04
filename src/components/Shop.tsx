"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_STREAK_FREEZES, STREAK_FREEZE_COST } from "@/core/economy";
import { buyStreakFreeze } from "@/lib/db";
import { useProfile } from "@/lib/useProfile";

/**
 * Obchod.
 *
 * Jediná položka, která se kupuje předem — nápověda i oprava se platí
 * v tu chvíli, kdy jsou potřeba, přímo u příkladu. Držet kvůli jedné
 * věci celou obrazovku by znamenalo posílat uživatele hledat.
 */
export function Shop() {
  const t = useTranslations("shop");
  const { profile } = useProfile();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const owned = profile.streakFreezes ?? 0;

  async function buy() {
    if (busy) return;
    setBusy(true);
    const result = await buyStreakFreeze(STREAK_FREEZE_COST, MAX_STREAK_FREEZES);
    setBusy(false);
    setNotice(
      result === "ok" ? null : result === "poor" ? t("freezePoor") : t("freezeFull", { max: MAX_STREAK_FREEZES }),
    );
  }

  return (
    <section className="border-line mt-6 rounded-panel border p-4">
      <h2 className="text-body font-semibold">{t("freezeTitle")}</h2>
      <p className="text-ink-soft mt-1 text-label">{t("freezeBody")}</p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="num text-ink-soft text-label" data-numeric>
          {t("freezeOwned", { count: owned })}
        </span>
        <button
          type="button"
          onClick={buy}
          disabled={busy || owned >= MAX_STREAK_FREEZES || profile.pills < STREAK_FREEZE_COST}
          className="bg-pill-wash text-pill min-h-11 shrink-0 rounded-control px-4 text-label font-semibold disabled:opacity-40"
        >
          {t("freezeBuy", { cost: STREAK_FREEZE_COST })}
        </button>
      </div>

      {notice ? <p className="text-ink-soft mt-2 text-label">{notice}</p> : null}
    </section>
  );
}
