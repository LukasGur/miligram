"use client";

import { useTranslations } from "next-intl";
import type { Duel } from "@/lib/remote";

/**
 * Souboje.
 *
 * Vypisují se všechny, protože jich je málo a rozdělovat je do záložek
 * by znamenalo hledat. Pořadí drží čas výzvy — co je nahoře, je čerstvé.
 */
export function Duels({
  duels,
  loading,
  onPlay,
}: {
  duels: readonly Duel[];
  loading: boolean;
  onPlay: (duel: { id: string; lessonId: string }) => void;
}) {
  const t = useTranslations("account");
  const rows = duels;

  return (
    <section className="mt-8">
      <h3 className="text-heading font-semibold">{t("duelsTitle")}</h3>

      {loading ? (
        <p className="text-ink-soft mt-3 text-label">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-ink-soft mt-3 text-label">{t("duelsEmpty")}</p>
      ) : (
        <ul className="border-line divide-line mt-3 divide-y rounded-control border">
          {rows.map((duel) => (
            <li key={duel.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <div className="flex-1">
                <p className="text-body">{duel.opponentHandle}</p>
                <p className="text-ink-soft text-micro">{status(duel, t)}</p>
              </div>
              {duel.mine === null ? (
                <button
                  type="button"
                  onClick={() => onPlay({ id: duel.id, lessonId: duel.lessonId })}
                  className="bg-accent active:bg-accent-press min-h-11 shrink-0 rounded-control px-4 text-label font-semibold text-white"
                >
                  {t("duelPlay")}
                </button>
              ) : duel.theirs ? (
                <span className="num text-body font-semibold" data-numeric>
                  {t("duelScore", { mine: duel.mine.correct, theirs: duel.theirs.correct })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Jedna věta o tom, co se souboji děje — kdo je na tahu, nebo jak dopadl. */
function status(
  duel: Duel,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): string {
  if (duel.mine === null) {
    return duel.challengedByMe ? t("duelWaiting", { handle: duel.opponentHandle }) : t("duelYourTurn", { handle: duel.opponentHandle });
  }
  if (duel.theirs === null) return t("duelWaiting", { handle: duel.opponentHandle });
  if (duel.mine.correct > duel.theirs.correct) return t("duelWon");
  if (duel.mine.correct < duel.theirs.correct) return t("duelLost");
  return t("duelDraw");
}
