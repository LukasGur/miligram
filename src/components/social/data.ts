"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useLiveQuery } from "dexie-react-hooks";
import { rankLeague } from "@/core/league";
import { db } from "@/lib/db";
import {
  duelRecord,
  fetchProfile,
  friendScores,
  friendSummaries,
  giftsSentCount,
  leagueHistory,
  leagueStanding,
  listDuels,
  pendingRequests,
  type Duel,
  type DuelRecord,
  type FriendRequest,
  type FriendSummary,
  type LeagueStanding,
  type LeagueWeek,
  type RemoteProfile,
  type ScoreRow,
  weekStart,
} from "@/lib/remote";
import { useRemoteQuery, type RemoteQuery } from "@/lib/remoteQuery";

/**
 * Data sociální vrstvy. Každý dotaz má vlastní klíč, takže se sdílí mezi
 * obrazovkami (profil i liga čtou tutéž ligu) a po akci se obnoví jen to,
 * co se změnilo.
 */
export type Social = {
  client: SupabaseClient;
  userId: string;
  profile: RemoteQuery<RemoteProfile | null>;
  duels: RemoteQuery<Duel[]>;
  record: RemoteQuery<DuelRecord>;
  league: RemoteQuery<LeagueStanding | null>;
  history: RemoteQuery<LeagueWeek[]>;
  friends: RemoteQuery<FriendSummary[]>;
  friendWeek: RemoteQuery<ScoreRow[]>;
  /** Vlastní XP tohoto týdne z telefonu; platí i bez spojení. */
  weekXp: number;
  requests: RemoteQuery<FriendRequest[]>;
  giftsSent: RemoteQuery<number>;
};

export function useSocial(client: SupabaseClient, userId: string): Social {
  const key = (name: string) => `${name}:${userId}`;
  const week = useWeekXp();
  const league = useRemoteQuery(key("league"), () => leagueStanding(client, userId));
  const friendWeek = useRemoteQuery(key("scores:week"), () => friendScores(client, userId, "week"));
  return {
    client,
    userId,
    profile: useRemoteQuery(key("profile"), () => fetchProfile(client, userId)),
    duels: useRemoteQuery(key("duels"), () => listDuels(client, userId)),
    record: useRemoteQuery(key("record"), () => duelRecord(client)),
    league: useOwnLeague(league, userId, week),
    history: useRemoteQuery(key("leagueHistory"), () => leagueHistory(client)),
    friends: useRemoteQuery(key("friends"), () => friendSummaries(client, userId)),
    friendWeek: useOwnScore(friendWeek, userId, week),
    weekXp: week?.xp ?? 0,
    requests: useRemoteQuery(key("requests"), () => pendingRequests(client, userId)),
    giftsSent: useRemoteQuery(key("giftsSent"), () => giftsSentCount(client, userId)),
  };
}

/**
 * Vlastní XP tohoto týdne z telefonu.
 *
 * Server ho zná, až k němu lekce doputuje. Kdo po lekci otevřel kamaráda,
 * aby viděl, jestli ho předehnal, měl u sebe nulu: odeslání ještě neběželo,
 * nebo ho po probuzení z pozadí zaseklo mrtvé spojení. Celkové XP se bralo
 * z telefonu odjakživa, týdenní teď taky.
 *
 * Týden se počítá jako na serveru (spouštěč lekce, migrace 0014): pražský
 * den dokončení, od pondělí. Telefon v jiném pásmu se může u půlnoci
 * o den splést; server pak platí díky `Math.max` níž.
 */
function useWeekXp(): { week: string; xp: number } | undefined {
  const week = weekStart();
  return useLiveQuery(
    async () => {
      const lessons = await db().lessons.where("finishedAt").aboveOrEqual(new Date(`${week}T00:00:00`).toISOString()).toArray();
      const xp = lessons.reduce((sum, lesson) => (weekStart(new Date(lesson.finishedAt)) === week ? sum + lesson.xp : sum), 0);
      return { week, xp };
    },
    [week],
  );
}

/**
 * Vlastní řádek s XP z telefonu, je-li vyšší. Nižší být může: lekce
 * z druhého zařízení server zná dřív, než se stáhnou sem.
 */
function withOwnXp<T extends { userId: string; xp: number }>(rows: readonly T[], userId: string, xp: number): T[] {
  return rows.map((row) => (row.userId === userId && xp > row.xp ? { ...row, xp } : row));
}

function useOwnScore(
  query: RemoteQuery<ScoreRow[]>,
  userId: string,
  week: { week: string; xp: number } | undefined,
): RemoteQuery<ScoreRow[]> {
  const { data } = query;
  const xp = week?.xp ?? 0;
  const patched = useMemo(() => (data ? withOwnXp(data, userId, xp) : data), [data, userId, xp]);
  return { ...query, data: patched };
}

function useOwnLeague(
  query: RemoteQuery<LeagueStanding | null>,
  userId: string,
  week: { week: string; xp: number } | undefined,
): RemoteQuery<LeagueStanding | null> {
  const { data } = query;
  const xp = week && data?.season === week.week ? week.xp : 0;
  const patched = useMemo(
    () => (data ? { ...data, rows: rankLeague(withOwnXp(data.rows, userId, xp)) } : data),
    [data, userId, xp],
  );
  return { ...query, data: patched };
}

/**
 * Hodiny pro odpočty. Tikají po minutě — lhůta v hodinách a konec týdne
 * ve dnech se rychleji nemění a častější překreslení by jen bralo baterii.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}

/** Zbývající čas po dnech, hodinách a minutách. */
export function splitDuration(ms: number): { days: number; hours: number; minutes: number } {
  const total = Math.max(Math.floor(ms / 60_000), 0);
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 };
}
