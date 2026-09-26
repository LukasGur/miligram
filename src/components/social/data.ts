"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  requests: RemoteQuery<FriendRequest[]>;
  giftsSent: RemoteQuery<number>;
};

export function useSocial(client: SupabaseClient, userId: string): Social {
  const key = (name: string) => `${name}:${userId}`;
  return {
    client,
    userId,
    profile: useRemoteQuery(key("profile"), () => fetchProfile(client, userId)),
    duels: useRemoteQuery(key("duels"), () => listDuels(client, userId)),
    record: useRemoteQuery(key("record"), () => duelRecord(client)),
    league: useRemoteQuery(key("league"), () => leagueStanding(client, userId)),
    history: useRemoteQuery(key("leagueHistory"), () => leagueHistory(client)),
    friends: useRemoteQuery(key("friends"), () => friendSummaries(client, userId)),
    friendWeek: useRemoteQuery(key("scores:week"), () => friendScores(client, userId, "week")),
    requests: useRemoteQuery(key("requests"), () => pendingRequests(client, userId)),
    giftsSent: useRemoteQuery(key("giftsSent"), () => giftsSentCount(client, userId)),
  };
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
