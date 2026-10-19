"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ShieldIcon } from "@/components/icons";
import { Monogram } from "@/components/ui/Monogram";
import { Pastille } from "@/components/ui/Pastille";
import { Spinner } from "@/components/ui/Spinner";
import { useAction, withTimeout } from "@/lib/useAction";
import { badgeStatesFromLevels, showcaseOrder, type BadgeLevels, type BadgeState } from "@/core/badges";
import { GIFT_FREEZE_COST } from "@/core/economy";
import { displayTier } from "@/core/league";
import { spendPills } from "@/lib/db";
import {
  duelRecord,
  duelsWith,
  giftSentThisWeek,
  removeFriend,
  sendGift,
  type Duel,
} from "@/lib/remote";
import { useRemoteQuery } from "@/lib/remoteQuery";
import { outcomeFor } from "@/lib/social";
import { useProfile } from "@/lib/useProfile";
import { BadgeGlyph } from "./BadgeGlyph";
import { BadgeSheet } from "./BadgeSheet";
import type { Social } from "./data";
import { Screen, SectionTitle } from "./Screen";
import { StuckLoading } from "@/components/ui/StuckLoading";
import { Button } from "@/components/ui/Button";

/**
 * Profil přítele.
 *
 * Vzájemná bilance jako hlavní číslo, pod ní ty vedle kamaráda a jeho
 * odznaky. Úspěšnost napoprvé tu schválně není: kamarádi vidí snahu,
 * chyby patří tomu, kdo se učí (migrace 0012). Odebrat je dole jako text
 * a s potvrzením, ať se netrefí omylem.
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
  const myWeek = Math.max(
    social.friendWeek.data?.find((row) => row.userId === social.userId)?.xp ?? 0,
    social.weekXp,
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const removing = useAction();

  if (!friend) {
    return (
      <Screen onBack={onBack}>
        {social.friends.loading ? (
          <StuckLoading target="/?open=account" onBack={onBack} />
        ) : (
          <p className="text-ink-soft mt-4 text-label">{t("friendGone")}</p>
        )}
      </Screen>
    );
  }

  const open = (social.duels.data ?? []).some(
    (duel) => duel.opponentId === friendId && (duel.status === "offered" || duel.status === "accepted"),
  );
  return (
    <Screen
      onBack={onBack}
      footer={
        open ? (
          <Button className="w-full" onClick={onOpenDuels}>{t("duelRunningOpen")}</Button>
        ) : (
          <Button className="w-full" onClick={onChallenge}>{t("challengeTitle", { handle: friend.handle })}</Button>
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
        <CompareRow label={t("statStreak")} mine={streak} theirs={friend.streak} />
        <CompareRow label={t("xpThisWeek")} mine={myWeek} theirs={friend.xpWeek} />
        <CompareRow label={t("xpTotal")} mine={local.xp} theirs={friend.xpTotal} />
      </dl>

      <FriendBadges levels={friend.badges} />

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
                disabled={removing.busy}
                onClick={() =>
                  void removing.run(async () => {
                    await removeFriend(social.client, social.userId, friendId);
                    onBack();
                  })
                }
                className="bg-ink flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control text-label font-semibold text-paper disabled:opacity-40"
              >
                {removing.busy ? <Spinner className="size-4" /> : null}
                {t("remove")}
              </button>
            </div>
            {removing.failed ? (
              <p className="text-ink-soft mt-2 text-label" role="status">
                {t("errorNetwork")}
              </p>
            ) : null}
          </div>
        ) : (
          <Button
            onClick={() => setConfirmRemove(true)}
            variant="text" tone="muted" className="underline underline-offset-4"
          >
            {t("removeFriend")}
          </Button>
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

/**
 * Kamarádovy odznaky: dosažené barevně a první, zbytek šedě. Klepnutí
 * ukáže, co odznak znamená a kolik stupňů má, ale bez průběhu — kolik mu
 * chybí, je jeho věc.
 */
function FriendBadges({ levels }: { levels: BadgeLevels }) {
  const t = useTranslations("social");
  const [open, setOpen] = useState<BadgeState | null>(null);
  const badges = showcaseOrder(badgeStatesFromLevels(levels));
  const unlocked = badges.filter((badge) => badge.level > 0).length;
  return (
    <>
      <SectionTitle
        aside={
          <span className="readout text-ink-soft text-label" data-numeric>
            {t("badgesCount", { unlocked, total: badges.length })}
          </span>
        }
      >
        {t("badgesTitle")}
      </SectionTitle>
      <ul className="grid grid-cols-4 gap-x-1 gap-y-4">
        {badges.map((badge) => (
          <li key={badge.id}>
            <button
              type="button"
              onClick={() => setOpen(badge)}
              className="group flex w-full flex-col items-center gap-1 text-center"
            >
              <span className="transition-transform duration-150 group-active:scale-94">
                <BadgeGlyph id={badge.id} level={badge.level} levels={badge.levels} />
              </span>
              <span className={`text-micro leading-tight ${badge.level > 0 ? "font-semibold" : "text-ink-soft"}`}>
                {t(`badge.${badge.id}.name`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open ? <BadgeSheet badge={open} withProgress={false} onClose={() => setOpen(null)} /> : null}
    </>
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
    if (profile.pills < GIFT_FREEZE_COST) return setNotice(tAccount("giftPoor", { cost: GIFT_FREEZE_COST }));
    setBusy(true);
    try {
      const result = await withTimeout(sendGift(social.client, social.userId, friendId));
      if (!result.ok) {
        setNotice(tAccount(result.reason === "usedUp" ? "giftUsedUp" : "giftRefused"));
        return;
      }
      await spendPills(GIFT_FREEZE_COST, "gift");
      setNotice(tAccount("giftSent"));
    } catch {
      setNotice(t("errorNetwork"));
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
        {busy ? <Spinner className="text-pill" /> : <ShieldIcon className="text-pill size-5 shrink-0" />}
        <span className="flex-1 text-body">{used.data ? t("giftDoneThisWeek") : t("giftStreak")}</span>
        <span className="readout text-pill flex items-center gap-1 text-label font-semibold" data-numeric>
          {format.number(GIFT_FREEZE_COST)}
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
