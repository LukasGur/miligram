"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { MAX_STREAK_FREEZES, STREAK_FREEZE_COST } from "@/core/economy";
import { buyStreakFreeze } from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import { CloseIcon, ShieldIcon } from "./icons";
import { Pastille } from "./ui/Pastille";
import { Readout } from "./ui/Readout";
import { TickScale } from "./ui/TickScale";

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

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

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
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label={t("title")} onClick={onClose} className="animate-scrim bg-ink/25 absolute inset-0" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-title"
        className="animate-sheet bg-paper relative mx-auto w-full max-w-md rounded-t-sheet"
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

            <button
              type="button"
              onClick={buy}
              disabled={busy}
              aria-describedby={poor || full ? "shop-freeze-why" : undefined}
              className={`mt-4 flex min-h-12 w-full items-center justify-between rounded-control px-4 text-body font-semibold transition-colors duration-75 ${
                poor || full
                  ? "border-line text-ink-soft active:bg-surface-press border"
                  : "bg-accent active:bg-accent-press text-white"
              }`}
            >
              <span>{t("freezeBuyShort")}</span>
              <span className="readout inline-flex items-center gap-1.5" data-numeric>
                <Pastille className="size-5 shrink-0" />
                {format.number(STREAK_FREEZE_COST)}
              </span>
            </button>

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
      </div>
    </div>
  );
}
