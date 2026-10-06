"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronDownIcon } from "@/components/icons";
import { LeagueInsignia } from "@/components/ui/LeagueInsignia";
import { Monogram } from "@/components/ui/Monogram";
import {
  displayTier,
  leagueGap,
  rankLeague,
  TOP_TIER,
  weekEndsAt,
  ZONES_FROM,
  type RankedEntry,
} from "@/core/league";
import { splitDuration, useNow, type Social } from "./data";
import { Screen } from "./Screen";

/**
 * Liga.
 *
 * Žebřík pěti lig, odpočet do konce týdne a pořadí. Hranice postupu
 * a sestupu jsou čáry se slovem, ne jen barva. Ve skupině, kde se ještě
 * nepostupuje (méně než devět lidí — tedy dnes skoro vždy), je hlavním
 * pořadím liga přátel a věta říká proč.
 */
export function LeagueScreen({
  social,
  onBack,
  onFriend,
}: {
  social: Social;
  onBack: () => void;
  onFriend: (userId: string) => void;
}) {
  const t = useTranslations("social");
  const format = useFormatter();
  const now = useNow();
  const standing = social.league.data ?? null;
  const friendRows = rankLeague(
    (social.friendWeek.data ?? []).map((row) => ({ userId: row.userId, handle: row.handle, xp: row.xp })),
  ).map((row) => ({ ...row, zone: null }));
  const tier = standing?.tier ?? 1;
  const groupSize = standing?.rows.length ?? 0;
  const zonesActive = groupSize >= ZONES_FROM;
  const [tab, setTab] = useState<"group" | "friends" | null>(null);
  const shown = tab ?? (zonesActive || friendRows.length <= 1 ? "group" : "friends");

  const end = weekEndsAt(new Date(now));
  const left = splitDuration(end.getTime() - now);
  // Pondělí je první den; kolik dní týdne už uběhlo včetně dneška.
  const dayOfWeek = ((new Date(now).getDay() + 6) % 7) + 1;
  const me = standing?.rows.find((row) => row.userId === social.userId);
  const gap = standing ? leagueGap(standing.rows, social.userId) : null;

  return (
    <Screen title={t("leagueTitle")} onBack={onBack} refresh="/?open=league">
      <ol className="mt-1 grid grid-cols-5 gap-1" aria-label={t("leagueLadder")}>
        {Array.from({ length: TOP_TIER }, (_, index) => {
          const rung = index + 1;
          const current = rung === tier;
          return (
            <li
              key={rung}
              aria-current={current ? "true" : undefined}
              className={`flex flex-col items-center gap-1.5 rounded-control px-0.5 pt-2.5 pb-2 text-center text-micro leading-tight ${
                current ? "bg-accent-wash text-accent font-semibold" : "text-ink-soft"
              }`}
            >
              <LeagueInsignia tier={rung} muted={!current} />
              <span data-numeric>{t("leagueName", { number: displayTier(rung) })}</span>
            </li>
          );
        })}
      </ol>

      <section className="border-line mt-4 flex items-stretch gap-4 rounded-panel border px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="panel-label">{t("weekEndsIn")}</p>
          <p className="readout mt-0.5 text-title font-semibold" data-numeric>
            {t("countdown", left)}
          </p>
          <div className="mt-2 flex gap-[3px]" aria-hidden>
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} className={`h-2.5 flex-1 rounded-[1px] ${index < dayOfWeek ? "bg-accent" : "bg-line"}`} />
            ))}
          </div>
        </div>
        {me ? (
          <div className="flex flex-col items-end text-right">
            <p className="panel-label">{t("yourPlace")}</p>
            <p className="readout mt-0.5 text-title font-semibold" data-numeric>
              {format.number(me.rank)}.
            </p>
            {gap ? (
              <p className="text-ink-soft mt-auto max-w-32 text-micro" data-numeric>
                {gap.kind === "promote" && tier < TOP_TIER
                  ? t("gapPromote", { xp: gap.xp })
                  : gap.kind === "safety" && tier > 1
                    ? t("gapSafety", { xp: gap.xp })
                    : null}
              </p>
            ) : me.zone === "promote" && tier < TOP_TIER ? (
              <p className="text-accent mt-auto text-micro font-medium">{t("inPromotion")}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {standing === null ? (
        <p className="text-ink-soft mt-6 text-label">{t("leagueEmpty")}</p>
      ) : (
        <>
          <div className="bg-surface mt-5 flex gap-1 rounded-control p-1" role="tablist">
            {(["group", "friends"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={shown === value}
                onClick={() => setTab(value)}
                className={`min-h-10 flex-1 rounded-[0.375rem] text-label font-medium ${
                  shown === value ? "bg-paper text-ink shadow-sm" : "text-ink-soft"
                }`}
                data-numeric
              >
                {value === "group"
                  ? t("tabGroup", { count: groupSize })
                  : t("tabFriends", { count: Math.max(friendRows.length - 1, 0) })}
              </button>
            ))}
          </div>

          {!zonesActive ? (
            <p className="text-ink-soft mt-3 text-label" data-numeric>
              {t("smallGroup", { size: groupSize, from: ZONES_FROM })}
            </p>
          ) : null}

          {shown === "group" ? (
            <Board rows={standing.rows} userId={social.userId} tier={tier} onFriend={onFriend} />
          ) : friendRows.length <= 1 ? (
            <p className="text-ink-soft mt-4 text-label">{t("friendsLeagueEmpty")}</p>
          ) : (
            <Board rows={friendRows} userId={social.userId} tier={tier} onFriend={onFriend} friends />
          )}
        </>
      )}

      <details className="border-line group mt-8 rounded-panel border px-4">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-label font-medium">
          {t("leagueRulesTitle")}
          <ChevronDownIcon className="text-ink-soft size-5 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="text-ink-soft -mt-1 flex list-disc flex-col gap-1.5 pb-4 pl-4 text-label">
          <li>{t("leagueRule1")}</li>
          <li>{t("leagueRule2", { from: ZONES_FROM })}</li>
          <li>{t("leagueRule3")}</li>
          <li>{t("leagueRule4")}</li>
        </ul>
      </details>
    </Screen>
  );
}

/**
 * Pořadí. Čára postupu a sestupu jen tam, kde se opravdu postupuje:
 * z 1. ligy už není kam a z 5. se nesestupuje.
 */
function Board({
  rows,
  userId,
  tier,
  onFriend,
  friends = false,
}: {
  rows: readonly RankedEntry[];
  userId: string;
  tier: number;
  onFriend: (userId: string) => void;
  friends?: boolean;
}) {
  const t = useTranslations("social");
  const format = useFormatter();

  return (
    <ol className="mt-3">
      {rows.map((row, index) => {
        const me = row.userId === userId;
        const previous = rows[index - 1];
        const promoteLine = previous?.zone === "promote" && row.zone !== "promote" && tier < TOP_TIER;
        const relegateLine = row.zone === "relegate" && previous?.zone !== "relegate" && tier > 1;
        const content = (
          <>
            <span className="readout text-ink-soft w-6 text-label" data-numeric>
              {row.rank}
            </span>
            <Monogram handle={row.handle} size="sm" />
            <span className="min-w-0 flex-1 truncate text-body">
              {row.handle}
              {me ? <span className="text-ink-soft ml-1 text-label">· {t("you")}</span> : null}
            </span>
            <span className="readout w-16 text-right text-body font-semibold" data-numeric>
              {format.number(row.xp)}
            </span>
          </>
        );
        return (
          <li key={row.userId}>
            {promoteLine ? <ZoneLine tone="up">{t("zonePromote", { number: displayTier(tier + 1) })}</ZoneLine> : null}
            {relegateLine ? <ZoneLine tone="down">{t("zoneRelegate", { number: displayTier(tier - 1) })}</ZoneLine> : null}
            {me || !friends ? (
              <div
                className={`border-line flex min-h-12 items-center gap-3 border-b ${
                  me ? "bg-accent-wash -mx-2.5 rounded-[0.375rem] border-transparent px-2.5" : ""
                }`}
              >
                {content}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onFriend(row.userId)}
                className="border-line active:bg-surface flex min-h-12 w-full items-center gap-3 border-b text-left"
              >
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ZoneLine({ tone, children }: { tone: "up" | "down"; children: React.ReactNode }) {
  return (
    <p
      className={`mt-3.5 mb-1 flex items-center gap-2 text-micro font-semibold tracking-[0.08em] uppercase before:h-px before:flex-1 before:bg-current before:opacity-35 after:h-px after:flex-1 after:bg-current after:opacity-35 ${
        tone === "up" ? "text-accent" : "text-ink-soft"
      }`}
    >
      {children}
    </p>
  );
}
