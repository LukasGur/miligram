"use client";

import { useFormatter, useTranslations } from "next-intl";
import { LeagueInsignia } from "@/components/ui/LeagueInsignia";
import { displayTier, PROMOTED, RELEGATED, TOP_TIER, ZONES_FROM } from "@/core/league";
import type { LeagueWeek } from "@/lib/remote";
import { Button } from "@/components/ui/Button";

export type WeekMove = "up" | "down" | "stay";

/** Kam minulý týden posunul. Stejné pravidlo jako server (migrace 0005). */
export function weekMove(week: LeagueWeek): WeekMove {
  if (week.size < ZONES_FROM) return "stay";
  if (week.rank <= PROMOTED && week.tier < TOP_TIER) return "up";
  if (week.rank > week.size - RELEGATED && week.tier > 1) return "down";
  return "stay";
}

/**
 * Konec týdne. Ukáže se jednou, při prvním otevření profilu v novém
 * týdnu. Přístroj neslaví konfetami: odznak ligy dostane další pruh.
 */
export function WeekResult({
  week,
  onClose,
}: {
  week: LeagueWeek;
  onClose: () => void;
}) {
  const t = useTranslations("social");
  const format = useFormatter();
  const move = weekMove(week);
  const tier = move === "up" ? week.tier + 1 : move === "down" ? week.tier - 1 : week.tier;
  const from = new Date(`${week.season}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);

  return (
    <div className="bg-paper fixed inset-0 z-40 flex flex-col" role="dialog" aria-modal="true" aria-labelledby="week-result">
      <div
        className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-7 text-center"
        style={{ paddingTop: "var(--sa-t)" }}
      >
        <p className="panel-label" data-numeric>
          {t("weekRange", { from, to })}
        </p>
        <LeagueInsignia tier={tier} size="lg" fresh={move === "up"} />
        <div>
          <h2 id="week-result" className="text-[1.75rem] leading-tight font-semibold tracking-tight text-balance">
            {t(`weekTitle.${move}`, { number: displayTier(tier) })}
          </h2>
          <p className="text-ink-soft mt-2 text-body" data-numeric>
            {t(`weekBody.${move}`, { rank: week.rank, size: week.size, from: ZONES_FROM })}
          </p>
        </div>
        <dl className="border-line divide-line grid w-full grid-cols-3 divide-x rounded-panel border">
          <Fact label={t("weekPlace")} value={`${format.number(week.rank)}.`} />
          <Fact label={t("weekOf")} value={format.number(week.size)} />
          <Fact label={t("weekLeague")} value={`${format.number(displayTier(tier))}.`} />
        </dl>
      </div>
      <div className="mx-auto w-full max-w-md px-5 pt-3" style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}>
        <Button className="w-full" onClick={onClose}>{t("continue")}</Button>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-2.5">
      <dd className="readout text-title font-semibold" data-numeric>
        {value}
      </dd>
      <dt className="panel-label">{label}</dt>
    </div>
  );
}

const SEEN_KEY = "miligram:weekSeen";

/** Týden, jehož výsledek už uživatel viděl. Pohodlí zařízení, ne data. */
export function seenWeek(userId: string): string | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "null") as { userId: string; season: string } | null;
    return raw?.userId === userId ? raw.season : null;
  } catch {
    return null;
  }
}

export function markWeekSeen(userId: string, season: string): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify({ userId, season }));
  } catch {
    // Bez úložiště se výsledek ukáže znovu; nic horšího se nestane.
  }
}

/** Poslední uzavřený týden, jehož výsledek se má ukázat. */
export function unseenWeek(history: readonly LeagueWeek[], currentSeason: string, userId: string): LeagueWeek | null {
  const last = [...history].reverse().find((week) => week.season < currentSeason);
  if (!last) return null;
  const seen = seenWeek(userId);
  return seen !== null && seen >= last.season ? null : last;
}
