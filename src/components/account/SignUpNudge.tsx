"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useTranslations } from "next-intl";
import { PersonIcon } from "@/components/icons";
import { SIGNUP_BONUS } from "@/core/economy";
import { db } from "@/lib/db";
import { pressable } from "@/lib/press";
import { isRemoteConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

/**
 * Po kolikáté dokončené lekci se výzva ukáže. Po první, dokud je radost
 * z prvního výsledku čerstvá, a po třetí, kdy už je z čeho mít postup.
 * Dál ne — kdo nechce, má klid; účet má svou ikonu na domovské obrazovce.
 */
const NUDGE_AFTER: readonly number[] = [1, 3];

/**
 * Výzva k založení účtu na konci lekce, jen nepřihlášenému.
 *
 * Hlavní důvod je přenos postupu do nového telefonu, pastilky jsou
 * navíc. Říká se to jako výhoda, ne jako hrozba — postup bez účtu
 * z telefonu nezmizí a strašit tím by bylo nepravdivé.
 */
export function SignUpNudge({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("lesson");
  const { session, ready } = useSession();
  const lessons = useLiveQuery(() => db().lessons.count(), []);

  if (!isRemoteConfigured() || !ready || session !== null) return null;
  if (lessons === undefined || !NUDGE_AFTER.includes(lessons)) return null;

  return (
    <section className="reveal-row bg-accent-wash rounded-panel mt-8 p-4" aria-labelledby="nudge-title">
      <div className="flex gap-3">
        <span className="bg-paper text-accent flex size-10 shrink-0 items-center justify-center rounded-full">
          <PersonIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="nudge-title" className="text-body font-semibold">
            {t("nudgeTitle")}
          </h2>
          <p className="text-ink-soft mt-0.5 text-label">{t("nudgeBody", { bonus: SIGNUP_BONUS })}</p>
        </div>
      </div>
      <button
        type="button"
        {...pressable}
        onClick={onOpen}
        className="press press-wide bg-paper text-accent border-accent/20 data-pressed:bg-accent-wash-press mt-3 flex min-h-11 w-full items-center justify-center rounded-control border text-label font-semibold"
      >
        {t("nudgeAction")}
      </button>
    </section>
  );
}
