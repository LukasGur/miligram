"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import { canPlayDuel, duelPhase, type DuelTopic } from "@/core/duel";
import { pushOnFor, usePushStatus } from "@/lib/push";
import { cancelDuel, requestFriend, respondDuel, weekStart, type Duel } from "@/lib/remote";
import { updatePulse } from "@/lib/pulse";
import { invalidateQueries } from "@/lib/remoteQuery";
import { markDuelSeen, unseenDuels } from "@/lib/duelSeen";
import { collectDuelRewards, duelsNeedingMe } from "@/lib/social";
import { supabase, isRemoteConfigured } from "@/lib/supabase";
import { streakFacts, useProfile } from "@/lib/useProfile";
import { withTimeout } from "@/lib/useAction";
import { useSession } from "@/lib/useSession";
import { PushOnboarding } from "@/components/push/PushOnboarding";
import { BadgesScreen } from "@/components/social/BadgesScreen";
import { ChallengeSheet, SentNotice } from "@/components/social/ChallengeSheet";
import { useSocial, type Social } from "@/components/social/data";
import { DuelOutcome } from "@/components/social/DuelOutcome";
import { DuelInviteSheet } from "@/components/social/DuelInviteSheet";
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
import { StuckLoading } from "@/components/ui/StuckLoading";

export type PlayableDuel = { id: string; lessonId: string; topic: DuelTopic };

/** Kam obrazovku otevřít: notifikace míří rovnou na souboje nebo ligu. */
export type AccountStart =
  | { screen: "duels" }
  | { screen: "league" }
  | { screen: "friends" }
  | { screen: "reveal"; duelId: string }
  /** Notifikace o konkrétním souboji: seznam soubojů a nad ním jeho karta. */
  | { screen: "duel"; duelId: string };

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
        <main tabIndex={0} data-refresh="/?open=account" className="scroll-y flex-1">
          <div className="mx-auto w-full max-w-md px-5 pb-10">
            {!isRemoteConfigured() || client === null ? (
              <section>
                <h2 className="text-heading font-semibold">{t("disabledTitle")}</h2>
                <p className="text-ink-soft mt-1.5 text-label">{t("disabledBody")}</p>
              </section>
            ) : !ready ? (
              <StuckLoading target="/?open=account" onBack={onClose} />
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
  if (start.screen === "duel") return [{ name: "profile" }, { name: "duels" }];
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
  /** Souboj z notifikace, jehož karta se ukáže nad seznamem soubojů. */
  const [focusDuel, setFocusDuel] = useState(start?.screen === "duel" ? start.duelId : null);

  // Co mění druhá strana — přijatá výzva, dohraný souboj, nová žádost —
  // se bez notifikace nedozvíme. Dokud je profil otevřený a vidět, ptá se
  // jednou za minutu; po návratu do aplikace hned (remoteQuery.ts).
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") invalidateQueries(["duels", "requests", "record"]);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

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

  // Souboje rozhodnuté bez uživatele: kdo dohrál první, výsledek ještě
  // nezná. Ukážou se po jednom, až po konci týdne. Počítadlo drží pořadí
  // („2 ze 3“), protože viděné ze seznamu hned mizí.
  const [resultsShown, setResultsShown] = useState(0);
  const unseen = duels ? unseenDuels(userId, duels) : [];
  const result = unseen[0];
  function seeResult(duel: Duel) {
    markDuelSeen(userId, duel.id);
    // Poslední z řady: další výsledek začne počítat znovu od jedné.
    setResultsShown((count) => (unseen.length <= 1 ? 0 : count + 1));
  }

  useEffect(() => {
    if (!duels || requestCount === undefined) return;
    updatePulse(userId, {
      handle,
      attention: duelsNeedingMe(duels) + requestCount + (weekPending ? 1 : 0) + unseen.length,
    });
  }, [userId, handle, duels, requestCount, weekPending, unseen.length]);

  function play(duel: Duel) {
    onPlayDuel({ id: duel.id, lessonId: duel.lessonId, topic: duel.topic });
  }

  const duelActions = {
    onPlay: play,
    onRespond: async (duel: Duel, accept: boolean, andPlay: boolean) => {
      const status = await respondDuel(client, duel.id, accept);
      if (status === "accepted" && andPlay) play(duel);
    },
  };

  /**
   * Souboj z notifikace. Dá-li se s ním něco udělat, vyjede jeho karta;
   * rozhodnutý rovnou ukáže výsledek. Jinak (čeká se na soupeře, propadl)
   * stačí seznam, ve kterém je vidět proč.
   */
  const focused = focusDuel ? duels?.find((one) => one.id === focusDuel) : undefined;
  const focusedPhase = focused ? duelPhase(focused) : null;
  // Seznam v paměti může být starší než notifikace, která právě přišla.
  useEffect(() => {
    if (start?.screen === "duel") invalidateQueries(["duels"]);
  }, [start]);
  // Stav se srovná při vykreslení, ne v efektu: obrazovka nemá problikat.
  if (focused && focusedPhase !== "incoming" && !canPlayDuel(focused)) {
    setFocusDuel(null);
    if (focusedPhase === "finished") setStack((current) => [...current, { name: "reveal", duelId: focused.id }]);
  }

  if (social.profile.loading && social.profile.data === undefined) {
    return <Shell onClose={onClose}><StuckLoading target="/?open=account" onBack={onClose} /></Shell>;
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
              ...duelActions,
              onCancel: async (duel) => {
                await cancelDuel(client, duel.id);
              },
              onReveal: (duel) => push({ name: "reveal", duelId: duel.id }),
              onNew: () => setChallenge({}),
            }}
          />
        );
      case "reveal": {
        const duel = social.duels.data?.find((one) => one.id === route.duelId);
        if (!duel) return <Shell onClose={back}><StuckLoading target="/?open=duels" onBack={back} /></Shell>;
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
      {focused && route.name === "duels" && (focusedPhase === "incoming" || canPlayDuel(focused)) ? (
        <DuelInviteSheet
          duel={focused}
          myHandle={social.profile.data?.handle ?? ""}
          actions={duelActions}
          onClose={() => setFocusDuel(null)}
        />
      ) : null}
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
          facts={streakFacts(local)}
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
      {result && !weekPending && !challenge && !onboarding && route.name === "profile" ? (
        <DuelOutcome
          key={result.id}
          duel={result}
          userId={userId}
          myHandle={social.profile.data?.handle ?? ""}
          position={{ index: resultsShown, total: resultsShown + unseen.length }}
          onRematch={
            social.friends.data?.some((friend) => friend.userId === result.opponentId)
              ? () => {
                  seeResult(result);
                  setChallenge({ friendId: result.opponentId, topic: result.topic });
                }
              : undefined
          }
          onDetail={() => {
            seeResult(result);
            push({ name: "duels" });
            push({ name: "reveal", duelId: result.id });
          }}
          onClose={() => seeResult(result)}
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
      <main tabIndex={0} data-refresh="/?open=account" className="scroll-y flex-1">
        <div className="mx-auto w-full max-w-md px-5 pb-10">{children}</div>
      </main>
    </div>
  );
}

export type { Social };
