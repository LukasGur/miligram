"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import type { DuelTopic } from "@/core/duel";
import { pushOnFor, usePushStatus } from "@/lib/push";
import { cancelDuel, requestFriend, respondDuel, weekStart, type Duel } from "@/lib/remote";
import { updatePulse } from "@/lib/pulse";
import { collectDuelRewards, duelsNeedingMe } from "@/lib/social";
import { supabase, isRemoteConfigured } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { withTimeout } from "@/lib/useAction";
import { useSession } from "@/lib/useSession";
import { PushOnboarding } from "@/components/push/PushOnboarding";
import { BadgesScreen } from "@/components/social/BadgesScreen";
import { ChallengeSheet, SentNotice } from "@/components/social/ChallengeSheet";
import { useSocial, type Social } from "@/components/social/data";
import { DuelReveal } from "@/components/social/DuelReveal";
import { DuelsScreen } from "@/components/social/DuelsScreen";
import { FriendProfile } from "@/components/social/FriendProfile";
import { FriendsScreen } from "@/components/social/FriendsScreen";
import { InviteLanding } from "@/components/social/InviteLanding";
import { LeagueScreen } from "@/components/social/LeagueScreen";
import { HandleForm, ProfileHome, useBadges } from "@/components/social/ProfileHome";
import { ToneSheet } from "@/components/social/ToneSheet";
import { markWeekSeen, unseenWeek, WeekResult } from "@/components/social/WeekResult";
import { SignIn } from "./SignIn";

export type PlayableDuel = { id: string; lessonId: string; topic: DuelTopic };

/** Kam obrazovku otevřít: notifikace míří rovnou na souboje nebo ligu. */
export type AccountStart =
  | { screen: "duels" }
  | { screen: "league" }
  | { screen: "friends" }
  | { screen: "reveal"; duelId: string };

type Route =
  | { name: "profile" }
  | { name: "league" }
  | { name: "duels" }
  | { name: "reveal"; duelId: string }
  | { name: "friends" }
  | { name: "friend"; id: string }
  | { name: "badges" };

/**
 * Profil, přátelé, liga a souboje.
 *
 * Celá obrazovka je nepovinná: bez přihlášení i bez nastaveného serveru
 * aplikace funguje dál, jen se nedá s nikým porovnat. Proto se sem nedostane
 * nic, bez čeho by lekce nešla dohrát.
 */
export function AccountScreen({
  onClose,
  onPlayDuel,
  start,
  invite,
  onInviteDone,
}: {
  onClose: () => void;
  onPlayDuel: (duel: PlayableDuel) => void;
  start?: AccountStart;
  /** Přezdívka z pozvánky v odkazu. */
  invite?: string;
  onInviteDone?: () => void;
}) {
  const t = useTranslations("account");
  const tSocial = useTranslations("social");
  const { session, ready } = useSession();
  const client = supabase();

  const invitation =
    invite && ready ? (
      <InviteLanding
        handle={invite}
        signedIn={session !== null && client !== null}
        onDismiss={() => onInviteDone?.()}
        onAdd={async () => {
          if (!client || !session) return { ok: false, message: "" };
          try {
            const result = await withTimeout(requestFriend(client, session.user.id, invite));
            if (result.ok) return { ok: true, message: tSocial("requestSent", { handle: invite }) };
            return {
              ok: result.reason === "duplicate",
              message: t(result.reason === "notFound" ? "friendNotFound" : result.reason === "self" ? "friendSelf" : "friendDuplicate"),
            };
          } catch {
            return { ok: false, message: tSocial("errorNetwork") };
          }
        }}
      />
    ) : null;

  if (!isRemoteConfigured() || client === null || !ready || session === null) {
    return (
      <div className="bg-paper flex h-dvh flex-col overflow-hidden">
        <header
          className="app-chrome flex items-center justify-between px-5 pb-2"
          style={{ paddingTop: "calc(var(--sa-t) + 0.75rem)" }}
        >
          <h1 className="text-heading font-semibold">{t("title")}</h1>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("title")}
            className="text-ink-soft -mr-3 flex size-11 items-center justify-center"
          >
            <CloseIcon className="size-6" />
          </button>
        </header>
        <main tabIndex={0} className="scroll-y flex-1">
          <div className="mx-auto w-full max-w-md px-5 pb-10">
            {!isRemoteConfigured() || client === null ? (
              <section>
                <h2 className="text-heading font-semibold">{t("disabledTitle")}</h2>
                <p className="text-ink-soft mt-1.5 text-label">{t("disabledBody")}</p>
              </section>
            ) : !ready ? (
              <p className="text-ink-soft text-label">{t("loading")}</p>
            ) : (
              <SignIn />
            )}
          </div>
        </main>
        {invitation}
      </div>
    );
  }

  return (
    <>
      <SignedIn
        client={client}
        userId={session.user.id}
        email={session.user.email}
        onClose={onClose}
        onPlayDuel={onPlayDuel}
        start={start}
      />
      {invitation}
    </>
  );
}

function initialRoutes(start?: AccountStart): Route[] {
  if (!start) return [{ name: "profile" }];
  if (start.screen === "reveal") return [{ name: "profile" }, { name: "duels" }, { name: "reveal", duelId: start.duelId }];
  return [{ name: "profile" }, { name: start.screen }];
}

function SignedIn({
  client,
  userId,
  email,
  onClose,
  onPlayDuel,
  start,
}: {
  client: NonNullable<ReturnType<typeof supabase>>;
  userId: string;
  email?: string;
  onClose: () => void;
  onPlayDuel: (duel: PlayableDuel) => void;
  start?: AccountStart;
}) {
  const tSocial = useTranslations("social");
  const social = useSocial(client, userId);
  const [stack, setStack] = useState<Route[]>(() => initialRoutes(start));
  const route = stack[stack.length - 1];
  const push = (next: Route) => setStack((current) => [...current, next]);
  const back = () => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  const badges = useBadges(social);
  /** Výzva je list nad obrazovkou, ne další obrazovka: nikam se neodchází. */
  const [challenge, setChallenge] = useState<{ friendId?: string; topic?: DuelTopic } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [toneOpen, setToneOpen] = useState(false);

  // Rozhodnuté souboje si zařízení připíše samo (pastilky žijí v telefonu).
  const duels = social.duels.data;
  useEffect(() => {
    if (duels) void collectDuelRewards(userId, duels);
  }, [duels, userId]);

  /**
   * Poslední krok registrace: připomínky. Jen u nového účtu, hned po první
   * přezdívce — a jen tam, kde se upozornění dají zapnout.
   */
  const [onboarding, setOnboarding] = useState(false);
  const pushStatus = usePushStatus();
  const { profile: local, streak } = useProfile();
  const canEnablePush =
    pushStatus.ready &&
    pushStatus.availability === "available" &&
    pushStatus.permission !== "denied" &&
    !pushOnFor(pushStatus, userId);

  // Výsledek minulého týdne, jednou.
  const [weekDismissed, setWeekDismissed] = useState(false);
  const pastWeek = social.history.data ? unseenWeek(social.history.data, weekStart(), userId) : null;

  // Tečka na domovské obrazovce se srovná hned, jak uživatel něco vyřídí.
  const handle = social.profile.data?.handle ?? null;
  const requestCount = social.requests.data?.length;
  const weekPending = pastWeek !== null && !weekDismissed;
  useEffect(() => {
    if (!duels || requestCount === undefined) return;
    updatePulse(userId, { handle, attention: duelsNeedingMe(duels) + requestCount + (weekPending ? 1 : 0) });
  }, [userId, handle, duels, requestCount, weekPending]);

  function refreshDuels() {
    social.duels.refresh();
    social.record.refresh();
  }

  function play(duel: Duel) {
    onPlayDuel({ id: duel.id, lessonId: duel.lessonId, topic: duel.topic });
  }

  if (social.profile.loading && social.profile.data === undefined) {
    return <Shell onClose={onClose}><p className="text-ink-soft text-label">{tSocial("loading")}</p></Shell>;
  }

  // Bez přezdívky není podle čeho člověka najít: jen formulář.
  if (social.profile.data === null) {
    return (
      <Shell onClose={onClose}>
        {onboarding ? null : (
          <HandleForm
            social={social}
            intro
            onSaved={(created) => {
              social.profile.refresh();
              if (created && canEnablePush) setOnboarding(true);
            }}
          />
        )}
      </Shell>
    );
  }

  const screen = (() => {
    switch (route.name) {
      case "league":
        return <LeagueScreen social={social} onBack={back} onFriend={(id) => push({ name: "friend", id })} />;
      case "duels":
        return (
          <DuelsScreen
            duels={social.duels.data ?? []}
            record={social.record.data}
            userId={userId}
            loading={social.duels.loading}
            onBack={back}
            actions={{
              onPlay: play,
              onRespond: async (duel, accept, andPlay) => {
                const status = await respondDuel(client, duel.id, accept);
                refreshDuels();
                if (status === "accepted" && andPlay) play(duel);
              },
              onCancel: async (duel) => {
                await cancelDuel(client, duel.id);
                refreshDuels();
              },
              onReveal: (duel) => push({ name: "reveal", duelId: duel.id }),
              onNew: () => setChallenge({}),
            }}
          />
        );
      case "reveal": {
        const duel = social.duels.data?.find((one) => one.id === route.duelId);
        if (!duel) return <Shell onClose={back}><p className="text-ink-soft text-label">{tSocial("loading")}</p></Shell>;
        const stillFriends = social.friends.data?.some((friend) => friend.userId === duel.opponentId) ?? false;
        return (
          <DuelReveal
            duel={duel}
            userId={userId}
            myHandle={social.profile.data?.handle ?? ""}
            onBack={back}
            onRematch={
              stillFriends
                ? () => setChallenge({ friendId: duel.opponentId, topic: duel.topic })
                : undefined
            }
          />
        );
      }
      case "friends":
        return <FriendsScreen social={social} onBack={back} onFriend={(id) => push({ name: "friend", id })} />;
      case "friend":
        return (
          <FriendProfile
            social={social}
            friendId={route.id}
            onBack={back}
            onChallenge={() => setChallenge({ friendId: route.id })}
            onReveal={(duel) => push({ name: "reveal", duelId: duel.id })}
            onOpenDuels={() => push({ name: "duels" })}
          />
        );
      case "badges":
        return <BadgesScreen badges={badges} onBack={back} />;
      default:
        return (
          <Shell onClose={onClose} title={tSocial("profileTitle")}>
            <ProfileHome
              social={social}
              email={email}
              onOpen={(name) => push({ name })}
              onChallenge={(friendId) => setChallenge({ friendId })}
              onEditTone={() => setToneOpen(true)}
            />
          </Shell>
        );
    }
  })();

  return (
    <>
      {screen}
      {challenge ? (
        <ChallengeSheet
          client={client}
          userId={userId}
          myHandle={social.profile.data?.handle ?? ""}
          friends={social.friends.data ?? []}
          duels={social.duels.data ?? []}
          friendId={challenge.friendId}
          topic={challenge.topic}
          onClose={() => setChallenge(null)}
          onCreated={(duel, playNow) => {
            refreshDuels();
            setChallenge(null);
            if (playNow) onPlayDuel({ id: duel.id, lessonId: duel.lessonId, topic: duel.topic });
            else setSent(duel.friend.handle);
          }}
        />
      ) : null}
      {sent ? <SentNotice handle={sent} onDone={() => setSent(null)} /> : null}
      {toneOpen ? <ToneSheet social={social} onClose={() => setToneOpen(false)} /> : null}
      {onboarding ? (
        <PushOnboarding
          userId={userId}
          streak={streak}
          facts={{
            streakDays: local.streakDays,
            streakFreezes: local.streakFreezes ?? 0,
            lastLessonDay: local.lastLessonDay,
          }}
          onDone={() => setOnboarding(false)}
        />
      ) : null}
      {pastWeek && !weekDismissed && route.name === "profile" ? (
        <WeekResult
          week={pastWeek}
          onClose={() => {
            markWeekSeen(userId, pastWeek.season);
            setWeekDismissed(true);
          }}
        />
      ) : null}
    </>
  );
}

/** Rámec hlavní obrazovky profilu: zavírá se křížkem, ne šipkou zpět. */
function Shell({ onClose, title, children }: { onClose: () => void; title?: string; children: React.ReactNode }) {
  const t = useTranslations("social");
  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <header
        className="app-chrome flex items-center justify-between px-5 pb-2"
        style={{ paddingTop: "calc(var(--sa-t) + 0.75rem)" }}
      >
        <h1 className="text-heading font-semibold">{title}</h1>
        <button type="button" onClick={onClose} aria-label={t("close")} className="text-ink-soft -mr-3 flex size-11 items-center justify-center">
          <CloseIcon className="size-6" />
        </button>
      </header>
      <main tabIndex={0} className="scroll-y flex-1">
        <div className="mx-auto w-full max-w-md px-5 pb-10">{children}</div>
      </main>
    </div>
  );
}

export type { Social };
