"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { Monogram } from "@/components/ui/Monogram";
import { Spinner } from "@/components/ui/Spinner";
import { withTimeout } from "@/lib/useAction";
import { resolveTone, TONES } from "@/core/monogram";
import { saveTone } from "@/lib/remote";
import { useChosenTone } from "@/lib/tones";
import type { Social } from "./data";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

/**
 * Barva monogramu.
 *
 * Každý vzorek je rovnou tvůj monogram v tom tónu — nevybírá se barva
 * naslepo, ale to, jak tě uvidí kamarádi. Náhled nahoře se mění hned,
 * uloží se až tlačítkem.
 */
export function ToneSheet({ social, onClose }: { social: Social; onClose: () => void }) {
  const t = useTranslations("social");
  const handle = social.profile.data?.handle ?? "";
  const chosen = useChosenTone(handle);
  const current = resolveTone(handle, social.profile.data?.tone ?? chosen);
  const [tone, setTone] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const selectedRef = useRef<HTMLButtonElement>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await withTimeout(saveTone(social.client, social.userId, handle, tone));
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      onClose={onClose}
      scrimLabel={t("close")}
      labelledBy="tone-title"
      initialFocus={selectedRef}
      style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 id="tone-title" className="text-heading font-semibold">
          {t("toneTitle")}
        </h2>
        <button type="button" onClick={onClose} aria-label={t("close")} className="text-ink-soft -mr-3 size-11 p-3">
          <CloseIcon className="size-5" />
        </button>
      </div>

      <div className="px-5">
        <div className="flex flex-col items-center pt-3 pb-5">
          <Monogram handle={handle || "?"} size="lg" tone={tone} />
          <p className="mt-2.5 text-body font-semibold">{handle}</p>
          <p className="text-ink-soft text-label">{t(`toneName.${tone}`)}</p>
        </div>

        <div role="radiogroup" aria-label={t("toneTitle")} className="grid grid-cols-4 justify-items-center gap-y-2">
          {Array.from({ length: TONES }, (_, value) => {
            const active = value === tone;
            return (
              <button
                key={value}
                ref={value === current ? selectedRef : undefined}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={t(`toneName.${value}`)}
                onClick={() => setTone(value)}
                className="relative grid size-16 place-items-center rounded-full"
              >
                <span
                  className={`rounded-full p-[3px] transition-shadow duration-150 ${
                    active ? "shadow-[0_0_0_2px_var(--color-accent)]" : ""
                  }`}
                >
                  <Monogram handle={handle || "?"} tone={value} />
                </span>
                {active ? (
                  <span className="bg-accent border-paper absolute right-1 bottom-1 grid size-5 place-items-center rounded-full border-2 text-on-accent">
                    <CheckIcon className="size-3" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="text-ink-soft mt-4 text-center text-micro">{t("toneHint")}</p>

        {error ? (
          <p className="text-ink mt-2 text-center text-label" role="status">
            {t("errorNetwork")}
          </p>
        ) : null}

        <Button
          onClick={() => void save()}
          disabled={busy || tone === current}
          aria-busy={busy}
          className="mt-4 w-full"
        >
          {busy ? <Spinner /> : null}
          {t("toneSave")}
        </Button>
      </div>
    </BottomSheet>
  );
}
