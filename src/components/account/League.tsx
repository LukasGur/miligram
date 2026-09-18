"use client";

import { useFormatter, useTranslations } from "next-intl";
import { LadderIcon } from "@/components/icons";
import { displayTier } from "@/core/league";
import type { LeagueStanding } from "@/lib/remote";

/**
 * Týdenní liga.
 *
 * Skupina dvaceti lidí místo celkového žebříčku: porovnání s dvaceti
 * lidmi něco znamená, pořadí mezi všemi uživateli aplikace ne. Řadí se
 * podle XP, ne podle prášků — kdo si koupí nápovědu, nesmí tím spadnout.
 */
export function League({ standing, userId }: { standing: LeagueStanding | null; userId: string }) {
  const t = useTranslations("account");
  const format = useFormatter();

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-heading font-semibold">
        <LadderIcon className="text-ink-soft size-5 shrink-0" />
        {t("leagueTitle")}
      </h2>
        {standing ? (
          <span className="readout text-accent text-label font-medium" data-numeric>
            {t("leagueTier", { tier: displayTier(standing.tier) })}
          </span>
        ) : null}
      </div>

      {standing === null ? (
        <p className="text-ink-soft mt-2 text-label">{t("leagueEmpty")}</p>
      ) : (
        <>
          <p className="text-ink-soft mt-1.5 text-label">{t("leagueHint")}</p>

          <ol className="border-line divide-line mt-4 divide-y border-y">
            {standing.rows.map((row) => {
              const me = row.userId === userId;
              return (
                <li
                  key={row.userId}
                  className={`flex items-center gap-3 py-2.5 ${me ? "bg-accent-wash -mx-2 px-2" : ""}`}
                >
                  <span className="readout text-ink-soft w-6 text-label" data-numeric>
                    {row.rank}
                  </span>
                  <span className="flex-1 text-body">
                    {row.handle}
                    {me ? <span className="text-ink-soft ml-1 text-label">· {t("you")}</span> : null}
                  </span>

                  {/* Zóna slovem, ne jen barvou — a jen u krajních míst,
                      aby prostředek seznamu zůstal klidný. */}
                  {row.zone ? (
                    <span
                      className={`panel-label ${row.zone === "promote" ? "!text-accent" : ""}`}
                    >
                      {t(row.zone === "promote" ? "leagueTop" : "leagueBottom")}
                    </span>
                  ) : null}

                  <span className="readout w-14 text-right text-body font-semibold" data-numeric>
                    {format.number(row.xp)}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
