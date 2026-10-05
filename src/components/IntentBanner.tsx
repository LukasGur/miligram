"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { IntentNote, OpenIntent } from "@/lib/openIntent";
import { CloseIcon, LadderIcon, UsersIcon, VersusIcon } from "./icons";

/** Jak dlouho proužek zůstane, než sám odjede. */
const VISIBLE_MS = 8_000;
/** O kolik pixelů se musí proužek přetáhnout nahoru, aby se zavřel. */
const SWIPE_PX = 28;

/**
 * Proužek nad lekcí po klepnutí na notifikaci.
 *
 * Kdo během lekce klepne na notifikaci, chce vědět, že se něco stalo —
 * ale lekci zahodit nechce. Proužek ukáže, co klepnul, a nechá ho
 * rozhodnout: Otevřít lekci odloží (každá odpověď je uložená) a otevře
 * cíl; jinak proužek po osmi vteřinách odjede a cíl počká do konce lekce.
 * Bez zvuku a vibrace, nepřekrývá zadání, jen hlavičku lekce.
 */
export function IntentBanner({
  intent,
  note,
  onOpen,
  onDismiss,
}: {
  intent: OpenIntent;
  note: IntentNote;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("lesson");
  const start = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const Icon = intent.startsWith("duel") || intent === "duels" ? VersusIcon : intent === "league" ? LadderIcon : UsersIcon;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3"
      style={{ paddingTop: "calc(var(--sa-t) + 0.5rem)" }}
    >
      <div
        role="status"
        aria-live="polite"
        onTouchStart={(event) => {
          start.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchMove={(event) => {
          const y = event.touches[0]?.clientY;
          if (start.current !== null && y !== undefined && start.current - y > SWIPE_PX) {
            start.current = null;
            onDismiss();
          }
        }}
        className="animate-drop bg-ink text-paper pointer-events-auto mx-auto flex w-full max-w-md items-center gap-3 rounded-panel py-2 pr-1.5 pl-2.5 shadow-lg"
      >
        <span className="bg-accent text-on-accent grid size-9 shrink-0 place-items-center rounded-full">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1 text-label leading-snug">
          <span className="line-clamp-2 block font-semibold">{note.title}</span>
          {note.body ? <span className="block truncate opacity-80">{note.body}</span> : null}
        </span>
        <button
          type="button"
          onClick={onOpen}
          className="bg-paper text-ink min-h-11 shrink-0 rounded-control px-3.5 text-label font-semibold"
        >
          {t("bannerOpen")}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("bannerDismiss")}
          className="grid size-11 shrink-0 place-items-center opacity-70"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
