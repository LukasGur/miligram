"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ShieldIcon, UsersIcon } from "@/components/icons";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  acceptFriend,
  createDuel,
  friendScores,
  giftSentThisWeek,
  pendingRequests,
  requestFriend,
  sendGift,
  type FriendRequest,
  type ScoreRow,
} from "@/lib/remote";
import { STREAK_FREEZE_COST } from "@/core/economy";
import { newLessonId } from "@/core/lessonPlan";
import { spendPills } from "@/lib/db";
import { useRemoteQuery } from "@/lib/remoteQuery";
import { useProfile } from "@/lib/useProfile";
import { Field } from "./SignIn";

/**
 * Přátelé a žebříček.
 *
 * Žebříček se řadí podle XP, ne podle prášků. Kdyby se řadil podle měny,
 * každá vzatá nápověda by uživatele srazila dolů a lidé by se vysvětlením
 * vyhýbali — přesně tomu, kvůli čemu aplikace existuje.
 */
export function Friends({
  client,
  userId,
  onChallenged,
}: {
  client: SupabaseClient;
  userId: string;
  onChallenged: () => void;
}) {
  const t = useTranslations("account");
  const format = useFormatter();

  const [scope, setScope] = useState<"week" | "total">("week");
  const [handle, setHandle] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { profile } = useProfile();
  const giftUsed = useRemoteQuery<boolean>(`gift:${userId}`, () => giftSentThisWeek(client, userId));
  const [sentNow, setSentNow] = useState(false);
  const canGift = giftUsed.data === false && !sentNow;

  const board = useRemoteQuery<ScoreRow[]>(`scores:${userId}:${scope}`, () =>
    friendScores(client, userId, scope),
  );
  const waiting = useRemoteQuery<FriendRequest[]>(`requests:${userId}`, () =>
    pendingRequests(client, userId),
  );
  const scores = board.error ? [] : board.data;
  const requests = waiting.data ?? [];

  /**
   * Dar kamarádovi. Prášky se strhnou až potom, co server dar přijme —
   * jinak by student zaplatil za dar, který neprošel.
   */
  async function gift(recipientId: string) {
    if (busy) return;
    setNotice(null);

    if (!canGift) {
      setNotice(t("giftUsedUp"));
      return;
    }
    if (profile.pills < STREAK_FREEZE_COST) {
      setNotice(t("giftPoor", { cost: STREAK_FREEZE_COST }));
      return;
    }

    setBusy(true);
    try {
      const result = await sendGift(client, userId, recipientId);
      if (!result.ok) {
        setNotice(t(result.reason === "usedUp" ? "giftUsedUp" : "giftRefused"));
        setSentNow(result.reason === "usedUp");
        return;
      }
      await spendPills(STREAK_FREEZE_COST, "gift");
      setSentNow(true);
      setNotice(t("giftSent"));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await requestFriend(client, userId, handle);
      if (result.ok) {
        setHandle("");
        setNotice(t("friendRequestSent"));
      } else {
        setNotice(t(result.reason === "notFound" ? "friendNotFound" : result.reason === "self" ? "friendSelf" : "friendDuplicate"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-heading font-semibold">
        <UsersIcon className="text-ink-soft size-5 shrink-0" />
        {t("friendsTitle")}
      </h2>

      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <Field label={t("friendHandle")} value={handle} onChange={setHandle} inputMode="text" />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={busy || handle.trim().length < 3}
          className="bg-accent active:bg-accent-press min-h-12 shrink-0 rounded-control px-4 text-body font-semibold text-white disabled:opacity-40"
        >
          {t("friendAdd")}
        </button>
      </div>
      {notice ? <p className="text-ink-soft mt-2 text-label">{notice}</p> : null}

      {requests.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-ink-soft text-micro font-semibold">{t("requestsTitle")}</h3>
          <ul className="border-line divide-line mt-2 divide-y rounded-control border">
            {requests.map((request) => (
              <li key={request.requester} className="flex min-h-12 items-center justify-between px-4">
                <span className="text-body">{request.handle}</span>
                <button
                  type="button"
                  onClick={async () => {
                    await acceptFriend(client, userId, request.requester);
                    waiting.refresh();
                    board.refresh();
                  }}
                  className="text-accent min-h-11 text-label font-medium"
                >
                  {t("accept")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        <div className="bg-surface flex gap-1 rounded-control p-1" role="tablist">
          {(["week", "total"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              onClick={() => setScope(value)}
              className={`min-h-11 flex-1 rounded-control text-label font-medium ${
                scope === value ? "bg-paper text-ink" : "text-ink-soft"
              }`}
            >
              {t(value === "week" ? "leaderboardWeek" : "leaderboardTotal")}
            </button>
          ))}
        </div>

        {scores === undefined ? (
          <p className="text-ink-soft mt-3 text-label">{t("loading")}</p>
        ) : scores.length <= 1 ? (
          <p className="text-ink-soft mt-3 text-label">{t("leaderboardEmpty")}</p>
        ) : (
          <ol className="border-line divide-line mt-3 divide-y rounded-control border">
            {scores.map((row, index) => (
              <li key={row.userId} className="flex min-h-12 items-center gap-3 px-4">
                <span className="readout text-ink-soft w-5 text-label">{index + 1}</span>
                <span className="flex-1 text-body">
                  {row.handle}
                  {row.userId === userId ? (
                    <span className="text-ink-soft ml-1 text-label">· {t("you")}</span>
                  ) : null}
                </span>
                <span className="readout text-body font-semibold">{format.number(row.xp)}</span>
                {row.userId === userId ? null : (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        // Souboj je jen sdílený identifikátor lekce; oba hráči
                        // si z něj sestaví tytéž příklady.
                        await createDuel(client, userId, row.userId, newLessonId());
                        setNotice(t("duelSent"));
                        onChallenged();
                      }}
                      className="text-accent min-h-11 shrink-0 text-label font-medium"
                    >
                      {t("duelChallenge")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void gift(row.userId)}
                      disabled={busy}
                      aria-label={t("giftAction", { handle: row.handle })}
                      className={`flex size-11 shrink-0 items-center justify-center ${
                        canGift && profile.pills >= STREAK_FREEZE_COST ? "text-pill" : "text-ink-soft"
                      }`}
                    >
                      <ShieldIcon className="size-5" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
