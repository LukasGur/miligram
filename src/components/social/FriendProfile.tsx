"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useFormatter, useTranslations } from "next-intl";
import { ShieldIcon } from "@/components/icons";
import { Monogram } from "@/components/ui/Monogram";
import { Pastille } from "@/components/ui/Pastille";
import { MASTERY_MIN_ANSWERS } from "@/core/curriculum";
import { localDay, STREAK_FREEZE_COST } from "@/core/economy";
import { displayTier } from "@/core/league";
import { categoryOfId } from "@/core/templateCategories";
import { CATEGORIES, type Category } from "@/core/types";
import { categoryScores } from "@/lib/curriculum";
import { spendPills } from "@/lib/db";
import {
  duelRecord,
  duelsWith,
  giftSentThisWeek,
  removeFriend,
  sendGift,
  templateStats,
  type Duel,
} from "@/lib/remote";
import { useRemoteQuery } from "@/lib/remoteQuery";
import { outcomeFor } from "@/lib/social";
import { useProfile } from "@/lib/useProfile";
import type { Social } from "./data";
import { PrimaryButton, Screen, SectionTitle, TextButton } from "./Screen";

type Rate = { answered: number; correct: number };

/**
 * Profil přítele.
 *
 * Vzájemná bilance jako hlavní číslo, pod ní ty vedle kamaráda.
 * Srovnání kategorií je zrcadlový graf: kde je tvůj pruh delší, tam ho
 * vyzvi. Odebrat je dole jako text a s potvrzením, ať se netrefí omylem.
 */
export function FriendProfile({
  social,
  friendId,
  onBack,
  onChallenge,
  onReveal,
  onOpenDuels,
}: {
  social: Social;
  friendId: string;
  onBack: () => void;
  onChallenge: () => void;
  onReveal: (duel: Duel) => void;
  onOpenDuels: () => void;
}) {
  const t = useTranslations("social");
  const format = useFormatter();
  const { profile: local, streak } = useProfile();
  const friend = social.friends.data?.find((one) => one.userId === friendId);
  const h2h = useRemoteQuery(`h2h:${social.userId}:${friendId}`, () => duelRecord(social.client, friendId));
  const recent = useRemoteQuery(`duelsWith:${social.userId}:${friendId}`, () =>
    duelsWith(social.client, social.userId, friendId),
  );
  const theirStats = useRemoteQuery(`templateStats:${friendId}`, () => templateStats(social.client, friendId));
  const mine = useLiveQuery(() => categoryScores(), []);
  const myWeek = social.friendWeek.data?.find((row) => row.userId === social.userId)?.xp ?? 0;
  const [showAll, setShowAll] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!friend) {
    return (
      <Screen onBack={onBack}>
        <p className="text-ink-soft mt-4 text-label">{social.friends.loading ? t("loading") : t("friendGone")}</p>
      </Screen>
    );
  }

  const open = (social.duels.data ?? []).some(
    (duel) => duel.opponentId === friendId && (duel.status === "offered" || duel.status === "accepted"),
  );
  const theirs = byCategory(theirStats.data ?? []);
  const compared = CATEGORIES.map((category) => ({
    category,
    mine: mine?.get(category),
    theirs: theirs.get(category),
  }))
    // Nejdřív, kde mají dost odpovědí oba: jen tam srovnání něco říká.
    .sort((a, b) => weight(b) - weight(a));
  const shown = showAll ? compared : compared.slice(0, 4);

  return (
    <Screen
      onBack={onBack}
      footer={
        open ? (
          <PrimaryButton onClick={onOpenDuels}>{t("duelRunningOpen")}</PrimaryButton>
        ) : (
          <PrimaryButton onClick={onChallenge}>{t("challengeTitle", { handle: friend.handle })}</PrimaryButton>
        )
      }
    >
      <section className="flex items-center gap-5 pb-5">
        <Monogram handle={friend.handle} size="lg" tier={friend.tier} />
        <div className="min-w-0">
          <p className="truncate text-title font-semibold">{friend.handle}</p>
          {friend.since ? (
            <p className="text-ink-soft mt-1 text-label">{t("friendsSince", { date: new Date(friend.since) })}</p>
          ) : null}
          <p className="text-accent mt-1.5 text-label font-semibold" data-numeric>
            {t("leagueName", { number: displayTier(friend.tier) })}
          </p>
        </div>
      </section>

      <div className="border-line grid grid-cols-[1fr_auto_1fr] items-center rounded-panel border px-3 py-4 text-center">
        <div>
          <p className="readout text-accent text-[2rem] leading-none font-semibold" data-numeric>
            {h2h.data ? format.number(h2h.data.wins) : "–"}
          </p>
          <p className="panel-label mt-1">{t("you")}</p>
        </div>
        <div className="px-3">
          <p className="panel-label">{t("headToHead")}</p>
          {h2h.data && h2h.data.draws > 0 ? (
            <p className="readout text-ink-soft text-micro" data-numeric>
              {t("draws", { count: h2h.data.draws })}
            </p>
          ) : null}
        </div>
        <div>
          <p className="readout text-[2rem] leading-none font-semibold" data-numeric>
            {h2h.data ? format.number(h2h.data.losses) : "–"}
          </p>
          <p className="panel-label mt-1 truncate">{friend.handle}</p>
        </div>
      </div>

      <dl className="mt-3">
        <CompareRow label={t("statStreak")} mine={streak} theirs={visibleStreak(friend.streakDays, friend.lastLessonDay)} />
        <CompareRow label={t("xpThisWeek")} mine={myWeek} theirs={friend.xpWeek} />
        <CompareRow label={t("xpTotal")} mine={local.xp} theirs={friend.xpTotal} />
      </dl>

      <SectionTitle>{t("byCategory")}</SectionTitle>
      <p className="text-ink-soft mb-3 flex justify-between text-micro">
        <span className="text-accent font-semibold">{t("you")}</span>
        <span>{t("firstTryRate")}</span>
        <span>{friend.handle}</span>
      </p>
      <div className="flex flex-col gap-3">
        {shown.map((row) => (
          <CategoryBars key={row.category} category={row.category} mine={row.mine} theirs={row.theirs} />
        ))}
      </div>
      <TextButton className="mt-1" onClick={() => setShowAll((value) => !value)}>
        {showAll ? t("showFewer") : t("showAllCategories", { count: CATEGORIES.length })}
      </TextButton>

      {(recent.data ?? []).length > 0 ? (
        <>
          <SectionTitle>{t("recentDuels")}</SectionTitle>
          <ul>
            {(recent.data ?? []).map((duel) => {
              const outcome = outcomeFor(social.userId, duel);
              return (
                <li key={duel.id}>
                  <button
                    type="button"
                    disabled={outcome === null}
                    onClick={() => onReveal(duel)}
                    className="border-line flex min-h-12 w-full items-center justify-between gap-3 border-b text-left disabled:opacity-60"
                  >
                    <span className="text-body">
                      {outcome ? t(`outcomeShort.${outcome}`) : t(`phaseShort.${duel.status}`)}
                    </span>
                    <span className="readout text-label font-semibold" data-numeric>
                      {duel.mine ? duel.mine.points : "–"} : {duel.theirs ? duel.theirs.points : "–"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <Gift social={social} friendId={friendId} handle={friend.handle} />

      <div className="mt-6">
        {confirmRemove ? (
          <div className="border-line rounded-panel border p-4">
            <p className="text-body">{t("removeConfirm", { handle: friend.handle })}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="border-line min-h-11 flex-1 rounded-control border text-label font-medium"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await removeFriend(social.client, social.userId, friendId);
                  social.friends.refresh();
                  social.friendWeek.refresh();
                  social.duels.refresh();
                  onBack();
                }}
                className="bg-ink min-h-11 flex-1 rounded-control text-label font-semibold text-white"
              >
                {t("remove")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="text-ink-soft min-h-11 text-label underline underline-offset-4"
          >
            {t("removeFriend")}
          </button>
        )}
      </div>
    </Screen>
  );
}

function CompareRow({ label, mine, theirs }: { label: string; mine: number; theirs: number }) {
  const format = useFormatter();
  return (
    <div className="border-line grid min-h-11 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b text-label">
      <dd className={`readout font-semibold ${mine >= theirs ? "text-accent" : ""}`} data-numeric>
        {format.number(mine)}
      </dd>
      <dt className="text-ink-soft text-center text-micro">{label}</dt>
      <dd className="readout text-right font-semibold" data-numeric>
        {format.number(theirs)}
      </dd>
    </div>
  );
}

function CategoryBars({ category, mine, theirs }: { category: Category; mine?: Rate; theirs?: Rate }) {
  const tCategory = useTranslations("categories");
  const left = percent(mine);
  const right = percent(theirs);
  return (
    <div>
      <div className="flex justify-between gap-2 text-label">
        <span className="truncate">{tCategory(category)}</span>
        <span className="readout text-ink-soft shrink-0 text-micro" data-numeric>
          {left === null ? "—" : left} · {right === null ? "—" : right}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-[3px]" aria-hidden>
        <span className="bg-surface relative h-1.5">
          <span className="bg-accent absolute inset-y-0 right-0" style={{ width: `${left ?? 0}%` }} />
        </span>
        <span className="bg-surface relative h-1.5">
          <span className="bg-ink-soft/60 absolute inset-y-0 left-0" style={{ width: `${right ?? 0}%` }} />
        </span>
      </div>
    </div>
  );
}

/**
 * Dar ochrany série. Pastilky se strhnou až potom, co server dar přijme —
 * jinak by student zaplatil za dar, který neprošel.
 */
function Gift({ social, friendId, handle }: { social: Social; friendId: string; handle: string }) {
  const t = useTranslations("social");
  const tAccount = useTranslations("account");
  const format = useFormatter();
  const { profile } = useProfile();
  const used = useRemoteQuery(`gift:${social.userId}`, () => giftSentThisWeek(social.client, social.userId));
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function give() {
    if (busy) return;
    setNotice(null);
    if (used.data) return setNotice(tAccount("giftUsedUp"));
    if (profile.pills < STREAK_FREEZE_COST) return setNotice(tAccount("giftPoor", { cost: STREAK_FREEZE_COST }));
    setBusy(true);
    try {
      const result = await sendGift(social.client, social.userId, friendId);
      if (!result.ok) {
        setNotice(tAccount(result.reason === "usedUp" ? "giftUsedUp" : "giftRefused"));
        return;
      }
      await spendPills(STREAK_FREEZE_COST, "gift");
      setNotice(tAccount("giftSent"));
      used.refresh();
      social.giftsSent.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => void give()}
        disabled={busy}
        aria-label={tAccount("giftAction", { handle })}
        className="border-line active:bg-surface flex min-h-13 w-full items-center gap-3 border-y text-left"
      >
        <ShieldIcon className="text-pill size-5 shrink-0" />
        <span className="flex-1 text-body">{used.data ? t("giftDoneThisWeek") : t("giftStreak")}</span>
        <span className="readout text-pill flex items-center gap-1 text-label font-semibold" data-numeric>
          {format.number(STREAK_FREEZE_COST)}
          <Pastille className="size-4" />
        </span>
      </button>
      {notice ? (
        <p className="text-ink-soft mt-2 text-label" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function byCategory(rows: readonly { templateId: string; answered: number; correct: number }[]): Map<Category, Rate> {
  const result = new Map<Category, Rate>();
  for (const row of rows) {
    const category = categoryOfId(row.templateId);
    if (!category) continue;
    const bucket = result.get(category) ?? { answered: 0, correct: 0 };
    bucket.answered += row.answered;
    bucket.correct += row.correct;
    result.set(category, bucket);
  }
  return result;
}

function percent(rate: Rate | undefined): number | null {
  if (!rate || rate.answered < MASTERY_MIN_ANSWERS) return null;
  return Math.round((rate.correct / rate.answered) * 100);
}

function weight(row: { mine?: Rate; theirs?: Rate }): number {
  const a = row.mine?.answered ?? 0;
  const b = row.theirs?.answered ?? 0;
  return Math.min(a, b) * 1000 + a + b;
}

/**
 * Série kamaráda ze serveru. Ochrany série server nezná, takže se bere
 * jen „včera nebo dnes“ — stejně jako u notifikací bez údaje z telefonu.
 */
function visibleStreak(days: number, lastDay: string | null): number {
  if (!lastDay) return 0;
  const today = localDay();
  const yesterday = localDay(new Date(Date.now() - 86_400_000));
  return lastDay === today || lastDay === yesterday ? days : 0;
}
