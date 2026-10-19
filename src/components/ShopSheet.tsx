"use client";

import { useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { MAX_STREAK_FREEZES, STREAK_FREEZE_COST } from "@/core/economy";
import { buyStreakFreeze } from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import { CloseIcon, ShieldIcon } from "./icons";
import { Pastille } from "./ui/Pastille";
import { Readout } from "./ui/Readout";
import { TickScale } from "./ui/TickScale";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

/**
 * Zásoby a nákup.
 *
 * Dřív to byla karta na domovské obrazovce a byla to tam nejnápadnější věc
 * po hlavním tlačítku — aplikace o učení měla nejhlasitější prvek na prodej.
 * Teď se otevře klepnutím na řádek s pastilkami, tedy přesně tehdy, když na ně
 * někdo myslí.
 */
export function ShopSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("shop");
  const tHome = useTranslations("home");
  const format = useFormatter();
  const { profile } = useProfile();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  if (!open) return null;

  const owned = profile.streakFreezes ?? 0;
  const full = owned >= MAX_STREAK_FREEZES;
  const poor = !full && profile.pills < STREAK_FREEZE_COST;
  /** Dílek stupnice je deset pastilek; ochrana jich stojí šest. */
  const tick = 10;

  async function buy() {
    if (busy) return;
    setBusy(true);
    const result = await buyStreakFreeze(STREAK_FREEZE_COST, MAX_STREAK_FREEZES);
    setBusy(false);
    // Proč nákup neprošel, stojí pod tlačítkem už předem; tady se hlásí
    // jen to, co předem vidět nebylo (zůstatek se mezitím změnil).
    setNotice(result === "ok" || poor || full ? null : t(result === "poor" ? "freezePoorShort" : "freezeFull", { max: MAX_STREAK_FREEZES }));
  }

  return (
    <BottomSheet
      onClose={onClose}
      scrimLabel={t("title")}
      labelledBy="shop-title"
      initialFocus={closeRef}
      style={{ paddingBottom: "calc(var(--sa-b) + 1rem)" }}
    >
      <div className="border-line flex items-center justify-between border-b px-5 py-4">
        <h2 id="shop-title" className="text-heading font-semibold">
          {t("title")}
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("title")}
          className="text-ink-soft -mr-3 size-11 p-3"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <Pastille className="size-9 shrink-0" />
          <Readout label={tHome("pills")} value={format.number(profile.pills)} />
        </div>

        <section className="border-line mt-6 border-t pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="flex items-center gap-2 text-body font-semibold">
              <ShieldIcon className="text-ink-soft size-5 shrink-0" />
              {t("freezeTitle")}
            </h3>
            <span className="text-ink-soft text-label" data-numeric>
              {t("freezeOwned", { count: owned })}
            </span>
          </div>
          <p className="text-ink-soft mt-1 text-label">{t("freezeBody")}</p>

          {/* Kolik chybí, je vidět hned, ne až po klepnutí: stupnice po deseti
              pastilkách a věta, za co přibývají. Tlačítko zůstává, jen ztichne;
              zašedlé se dřív přehlédlo a neřeklo proč. */}
          {poor ? (
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <TickScale
                  total={STREAK_FREEZE_COST / tick}
                  done={Math.floor(profile.pills / tick)}
                  label={t("freezeProgress", { have: profile.pills, cost: STREAK_FREEZE_COST })}
                />
                <span className="readout text-ink-soft shrink-0 text-label" data-numeric>
                  {format.number(profile.pills)}/{format.number(STREAK_FREEZE_COST)}
                </span>
              </div>
              <p className="text-ink-soft mt-2 text-label">
                {t("freezePoor", { missing: STREAK_FREEZE_COST - profile.pills })}
              </p>
            </div>
          ) : null}

          <Button
            onClick={buy}
            disabled={busy}
            aria-describedby={poor || full ? "shop-freeze-why" : undefined}
            variant={poor || full ? "secondary" : "primary"}
            tone="muted"
            size="md"
            className="mt-4 w-full"
          >
            <span className="flex w-full items-center justify-between">
              <span>{t("freezeBuyShort")}</span>
              <span className="readout inline-flex items-center gap-1.5" data-numeric>
                <Pastille className="size-5 shrink-0" />
                {format.number(STREAK_FREEZE_COST)}
              </span>
            </span>
          </Button>

          {full ? (
            <p id="shop-freeze-why" className="text-ink-soft mt-2 text-label">
              {t("freezeFull", { max: MAX_STREAK_FREEZES })}
            </p>
          ) : poor ? (
            <span id="shop-freeze-why" className="sr-only">
              {t("freezePoor", { missing: STREAK_FREEZE_COST - profile.pills })}
            </span>
          ) : null}

          {notice ? (
            <p className="text-ink mt-2 text-label" role="status">
              {notice}
            </p>
          ) : null}
        </section>
      </div>
    </BottomSheet>
  );
}
