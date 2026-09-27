"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { VersusIcon } from "@/components/icons";
import type { DuelTopic } from "@/core/duel";
import { friendSummaries, listDuels } from "@/lib/remote";
import { useRemoteQuery } from "@/lib/remoteQuery";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import type { PlayableDuel } from "@/components/account/AccountScreen";
import { ChallengeSheet, SentNotice } from "./ChallengeSheet";
import { FriendDuelChip, friendsByDuelState, InviteChip } from "./FriendDuelChip";

/**
 * Výzva po dohrané lekci.
 *
 * Tady chuť změřit se vzniká: student je rozehraný a právě ví, jak mu
 * téma jde. Karta nabídne řadu kamarádů se stavem souboje; volného
 * klepnutí vyzve na totéž téma, ostatní vedou na souboje. Kdo kamarády nemá, dostane pozvánku. Nepřihlášenému se neukáže —
 * o to se stará lekce, která kartu vůbec nenačte.
 *
 * Dotazy mají stejné klíče jako v profilu (components/social/data.ts),
 * takže po otevření profilu se nestahuje znovu.
 */
export function LessonChallenge({
  topic,
  myHandle,
  onPlay,
  onInvite,
  onOpenDuels,
}: {
  topic?: DuelTopic;
  myHandle: string;
  onPlay: (duel: PlayableDuel) => void;
  onInvite: () => void;
  /** Kamarád, se kterým souboj běží: klepnutí vede na souboje. */
  onOpenDuels: () => void;
}) {
  const t = useTranslations("social");
  const tCategory = useTranslations("categories");
  const { session } = useSession();
  const client = supabase();
  const userId = session?.user.id ?? null;
  const friends = useRemoteQuery(userId && client ? `friends:${userId}` : null, () => friendSummaries(client!, userId!));
  const duels = useRemoteQuery(userId && client ? `duels:${userId}` : null, () => listDuels(client!, userId!));
  const [picked, setPicked] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (!client || !userId || friends.data === undefined) return null;

  const list = duels.data ?? [];
  const body = !topic
    ? t("lessonChallengeBodyAny")
    : t("lessonChallengeBody", { topic: topic === "mix" ? t("topicMix") : tCategory(topic) });

  return (
    <section className="animate-rise border-line mt-6 rounded-panel border" aria-labelledby="lesson-challenge">
      <div className="flex items-start gap-3 px-3.5 pt-3.5">
        <span className="bg-accent-wash text-accent grid size-9 shrink-0 place-items-center rounded-full">
          <VersusIcon className="size-[1.125rem]" />
        </span>
        <div className="min-w-0">
          <h2 id="lesson-challenge" className="text-body font-semibold">
            {friends.data.length > 0 ? t("lessonChallengeTitle") : t("lessonChallengeLonely")}
          </h2>
          <p className="text-ink-soft text-label" data-numeric>
            {friends.data.length > 0 ? body : t("lessonChallengeInvite")}
          </p>
        </div>
      </div>

      <div className="mt-1.5 flex overflow-x-auto px-1.5 pb-2">
        {friendsByDuelState(friends.data, list).map(({ friend, state }) => (
          <FriendDuelChip
            key={friend.userId}
            friend={friend}
            state={state}
            onSelect={() => (state === "free" ? setPicked(friend.userId) : onOpenDuels())}
          />
        ))}
        <InviteChip onSelect={onInvite} />
      </div>

      {picked ? (
        <ChallengeSheet
          client={client}
          userId={userId}
          myHandle={myHandle}
          friends={friends.data}
          duels={list}
          friendId={picked}
          topic={topic}
          onClose={() => setPicked(null)}
          onCreated={(duel, playNow) => {
            duels.refresh();
            setPicked(null);
            if (playNow) onPlay({ id: duel.id, lessonId: duel.lessonId, topic: duel.topic });
            else setSent(duel.friend.handle);
          }}
        />
      ) : null}
      {sent ? <SentNotice handle={sent} onDone={() => setSent(null)} /> : null}
    </section>
  );
}
