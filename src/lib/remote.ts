"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBadgeLevels, type BadgeLevels } from "@/core/badges";
import { isDuelTopic, type DuelMark, type DuelStatus, type DuelTopic } from "@/core/duel";
import { rankLeague, type RankedEntry } from "@/core/league";
import type { RemoteLesson } from "./restore";
import { rememberTones } from "./tones";
import type { LessonEventRow, SyncGateway } from "./sync";

/**
 * Dotazy proti serveru.
 *
 * Nikde tu není kontrola oprávnění — tu dělá Row Level Security v databázi.
 * Kdyby se sem nějaká připletla, byla by to kosmetika: statický export nemá
 * server, kde by šla vynutit.
 */

export type RemoteProfile = {
  id: string;
  handle: string;
  displayName: string;
  createdAt: string;
  /** Vybraný tón monogramu; null = z přezdívky. */
  tone: number | null;
};

export type ScoreRow = {
  userId: string;
  handle: string;
  displayName: string;
  xp: number;
};

export function remoteGateway(client: SupabaseClient, userId: string): SyncGateway {
  return {
    async pushLessonEvents(rows: readonly LessonEventRow[]) {
      const { error } = await client
        .from("lesson_events")
        .upsert(
          rows.map((row) => ({ ...row, user_id: userId })),
          // Opakované odeslání téže události není chyba, jen se zahodí.
          { onConflict: "user_id,client_event_id", ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * Stažení vlastní historie pro obnovu na novém zařízení.
 *
 * Stránkuje se, protože po roce hraní jde o stovky záznamů a jediný dotaz
 * by narazil na strop odpovědi. Řadí se od nejstarší, aby se série skládala
 * ve stejném pořadí, v jakém vznikala.
 */
const PAGE = 500;

export async function fetchLessons(
  client: SupabaseClient,
  userId: string,
  since?: string,
): Promise<RemoteLesson[]> {
  const lessons: RemoteLesson[] = [];

  for (let from = 0; ; from += PAGE) {
    let query = client
      .from("lesson_events")
      .select("lesson_id, kind, answers, finished_at")
      .eq("user_id", userId);
    // Hranice je včetně: lekce se stejným časem by při ostrém větším
    // propadla. Znovu stažená lekce nevadí, slučuje se podle lessonId.
    if (since) query = query.gte("finished_at", since);

    const { data, error } = await query
      .order("finished_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);

    const page = data ?? [];
    lessons.push(
      ...page.map((row) => ({
        lessonId: row.lesson_id,
        finishedAt: row.finished_at,
        kind: row.kind === "review" ? ("review" as const) : ("lesson" as const),
        answers: (row.answers as RemoteLesson["answers"]) ?? [],
      })),
    );
    if (page.length < PAGE) return lessons;
  }
}

export async function fetchProfile(client: SupabaseClient, userId: string): Promise<RemoteProfile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, handle, display_name, created_at, tone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) rememberTones([data]);
  return data
    ? { id: data.id, handle: data.handle, displayName: data.display_name, createdAt: data.created_at, tone: data.tone }
    : null;
}

/** Tón monogramu. Null vrátí ten z přezdívky. */
export async function saveTone(client: SupabaseClient, userId: string, handle: string, tone: number | null): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ tone, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  rememberTones([{ handle, tone }]);
}

/** Přezdívka se zabírá zápisem — o jedinečnost se stará index, ne kontrola předem. */
export async function claimHandle(
  client: SupabaseClient,
  userId: string,
  handle: string,
): Promise<{ ok: true } | { ok: false; reason: "taken" | "invalid" }> {
  const normalized = handle.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) return { ok: false, reason: "invalid" };

  const { error } = await client
    .from("profiles")
    .upsert({ id: userId, handle: normalized, updated_at: new Date().toISOString() });

  if (!error) return { ok: true };
  // 23505 je porušení jedinečnosti — přezdívku má někdo jiný.
  if (error.code === "23505") return { ok: false, reason: "taken" };
  throw new Error(error.message);
}

/** Pondělí probíhajícího týdne, ve stejném tvaru, jaký drží tabulka weekly_xp. */
export function weekStart(date = new Date()): string {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - weekday);
  return copy.toISOString().slice(0, 10);
}

/**
 * Žebříček přátel. Vrací i samotného uživatele — bez něj by nebylo vidět,
 * kde v pořadí stojí, a to je jediné, kvůli čemu se do žebříčku dívá.
 */
export async function friendScores(
  client: SupabaseClient,
  userId: string,
  scope: "week" | "total",
): Promise<ScoreRow[]> {
  const friends = await acceptedFriendIds(client, userId);
  const ids = [...friends, userId];

  const [profiles, scores] = await Promise.all([
    client.from("profiles").select("id, handle, display_name, tone").in("id", ids),
    scope === "week"
      ? client.from("weekly_xp").select("user_id, xp").eq("week_start", weekStart()).in("user_id", ids)
      : client.from("stats").select("user_id, xp_total").in("user_id", ids),
  ]);

  if (profiles.error) throw new Error(profiles.error.message);
  if (scores.error) throw new Error(scores.error.message);
  rememberTones(profiles.data ?? []);

  const xpByUser = new Map<string, number>();
  for (const row of scores.data ?? []) {
    const value = "xp" in row ? row.xp : row.xp_total;
    xpByUser.set(row.user_id, Number(value ?? 0));
  }

  return (profiles.data ?? [])
    .map((profile) => ({
      userId: profile.id,
      handle: profile.handle,
      displayName: profile.display_name,
      xp: xpByUser.get(profile.id) ?? 0,
    }))
    .sort((a, b) => b.xp - a.xp || a.handle.localeCompare(b.handle));
}

async function acceptedFriendIds(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client
    .from("friendships")
    .select("requester, addressee, status")
    .eq("status", "accepted");
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => (row.requester === userId ? row.addressee : row.requester));
}

export type FriendRequest = { requester: string; handle: string; createdAt: string };

export async function pendingRequests(client: SupabaseClient, userId: string): Promise<FriendRequest[]> {
  const { data, error } = await client
    .from("friendships")
    .select("requester, created_at")
    .eq("addressee", userId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  if ((data ?? []).length === 0) return [];

  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id, handle, tone")
    .in("id", (data ?? []).map((row) => row.requester));
  if (profileError) throw new Error(profileError.message);
  rememberTones(profiles ?? []);

  const handles = new Map((profiles ?? []).map((profile) => [profile.id, profile.handle]));
  return (data ?? []).map((row) => ({
    requester: row.requester,
    handle: handles.get(row.requester) ?? "",
    createdAt: row.created_at,
  }));
}

export async function requestFriend(
  client: SupabaseClient,
  userId: string,
  handle: string,
): Promise<{ ok: true } | { ok: false; reason: "notFound" | "self" | "duplicate" }> {
  const normalized = handle.trim().toLowerCase();
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("handle", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ok: false, reason: "notFound" };
  if (data.id === userId) return { ok: false, reason: "self" };

  const { error: insertError } = await client
    .from("friendships")
    .insert({ requester: userId, addressee: data.id });
  if (!insertError) return { ok: true };
  if (insertError.code === "23505") return { ok: false, reason: "duplicate" };
  throw new Error(insertError.message);
}

export async function acceptFriend(client: SupabaseClient, userId: string, requester: string): Promise<void> {
  const { error } = await client
    .from("friendships")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("requester", requester)
    .eq("addressee", userId);
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------------------------------
   Souboje

   Souboj nese identifikátor lekce a téma. Oba hráči si z nich sestaví tytéž
   příklady, takže se nikam neposílá zadání ani odpovědi — jen body a čas.
   Kdo vyhrál, rozhoduje server (migrace 0010); výsledek soupeře pustí až
   po vlastním dohrání.
   ------------------------------------------------------------------------ */

export type DuelResult = {
  correct: number;
  count: number;
  points: number;
  durationMs: number | null;
  /** Značky po příkladech. Chybí u výsledků ze starší verze. */
  items?: DuelMark[] | null;
};

export type Duel = {
  id: string;
  lessonId: string;
  topic: DuelTopic;
  status: DuelStatus;
  opponentId: string;
  opponentHandle: string;
  challengedByMe: boolean;
  createdAt: string;
  acceptedAt: string | null;
  resolvedAt: string | null;
  /** Kdo vyhrál; null u remízy a u nerozhodnutého souboje. */
  winnerId: string | null;
  forfeit: boolean;
  playedByMe: boolean;
  playedByThem: boolean;
  mine: DuelResult | null;
  /** Soupeřův výsledek. Server ho pustí až po vlastním dohrání. */
  theirs: DuelResult | null;
};

export type CreateDuelResult = { ok: true; id: string } | { ok: false; reason: "open" | "refused" };

export async function createDuel(
  client: SupabaseClient,
  userId: string,
  opponentId: string,
  lessonId: string,
  topic: DuelTopic,
): Promise<CreateDuelResult> {
  const { data, error } = await client
    .from("duels")
    .insert({ lesson_id: lessonId, challenger: userId, opponent: opponentId, topic })
    .select("id")
    .single();
  if (!error && data) return { ok: true, id: data.id };
  // Jedinečnost otevřeného souboje na dvojici.
  if (error?.code === "23505") return { ok: false, reason: "open" };
  if (error?.code === "42501") return { ok: false, reason: "refused" };
  throw new Error(error?.message ?? "Souboj se nezaložil.");
}

/** Přijetí nebo odmítnutí. Vrací nový stav, nebo null, když už nebylo na co. */
export async function respondDuel(client: SupabaseClient, duelId: string, accept: boolean): Promise<DuelStatus | null> {
  const { data, error } = await client.rpc("respond_duel", { p_duel: duelId, p_accept: accept });
  if (error) throw new Error(error.message);
  return (data as DuelStatus | null) ?? null;
}

/** Stažení nepřijaté výzvy. */
export async function cancelDuel(client: SupabaseClient, duelId: string): Promise<void> {
  const { error } = await client.from("duels").delete().eq("id", duelId);
  if (error) throw new Error(error.message);
}

const DUEL_COLUMNS =
  "id, lesson_id, topic, status, challenger, opponent, created_at, accepted_at, resolved_at, winner, forfeit, challenger_played, opponent_played";

type DuelRow = {
  id: string;
  lesson_id: string;
  topic: string;
  status: DuelStatus;
  challenger: string;
  opponent: string;
  created_at: string;
  accepted_at: string | null;
  resolved_at: string | null;
  winner: string | null;
  forfeit: boolean;
  challenger_played: boolean;
  opponent_played: boolean;
};

export async function listDuels(client: SupabaseClient, userId: string, limit = 40): Promise<Duel[]> {
  const { data, error } = await client
    .from("duels")
    .select(DUEL_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return hydrateDuels(client, userId, (data ?? []) as DuelRow[]);
}

/** Souboje s jedním kamarádem, pro jeho profil. */
export async function duelsWith(client: SupabaseClient, userId: string, otherId: string, limit = 5): Promise<Duel[]> {
  const { data, error } = await client
    .from("duels")
    .select(DUEL_COLUMNS)
    .or(`challenger.eq.${otherId},opponent.eq.${otherId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return hydrateDuels(client, userId, (data ?? []) as DuelRow[]);
}

async function hydrateDuels(client: SupabaseClient, userId: string, rows: DuelRow[]): Promise<Duel[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((duel) => duel.id);
  const opponents = [...new Set(rows.map((duel) => (duel.challenger === userId ? duel.opponent : duel.challenger)))];

  const [results, profiles] = await Promise.all([
    client.from("duel_results").select("duel_id, user_id, correct, count, points, duration_ms, items").in("duel_id", ids),
    client.from("profiles").select("id, handle, tone").in("id", opponents),
  ]);
  if (results.error) throw new Error(results.error.message);
  if (profiles.error) throw new Error(profiles.error.message);
  rememberTones(profiles.data ?? []);

  const handles = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.handle]));
  type ResultRow = {
    user_id: string;
    correct: number;
    count: number;
    points: number | null;
    duration_ms: number | null;
    items: DuelMark[] | null;
  };
  const byDuel = new Map<string, ResultRow[]>();
  for (const row of (results.data ?? []) as (ResultRow & { duel_id: string })[]) {
    byDuel.set(row.duel_id, [...(byDuel.get(row.duel_id) ?? []), row]);
  }
  const result = (row: ResultRow | undefined): DuelResult | null =>
    row
      ? {
          correct: row.correct,
          count: row.count,
          points: row.points ?? row.correct,
          durationMs: row.duration_ms,
          items: row.items,
        }
      : null;

  return rows.map((duel) => {
    const mineIsChallenger = duel.challenger === userId;
    const opponentId = mineIsChallenger ? duel.opponent : duel.challenger;
    const found = byDuel.get(duel.id) ?? [];
    return {
      id: duel.id,
      lessonId: duel.lesson_id,
      topic: isDuelTopic(duel.topic) ? duel.topic : "mix",
      status: duel.status,
      opponentId,
      opponentHandle: handles.get(opponentId) ?? "",
      challengedByMe: mineIsChallenger,
      createdAt: duel.created_at,
      acceptedAt: duel.accepted_at,
      resolvedAt: duel.resolved_at,
      winnerId: duel.winner,
      forfeit: duel.forfeit,
      playedByMe: mineIsChallenger ? duel.challenger_played : duel.opponent_played,
      playedByThem: mineIsChallenger ? duel.opponent_played : duel.challenger_played,
      mine: result(found.find((row) => row.user_id === userId)),
      theirs: result(found.find((row) => row.user_id === opponentId)),
    };
  });
}

/**
 * Zapíše vlastní výsledek. Opakovaný zápis narazí na primární klíč —
 * souboj se nedá dohrát dvakrát a vylepšit si tím skóre. Vrací false,
 * když ho server odmítl (lhůta vypršela) — pak nemá smysl to zkoušet znovu.
 */
export async function recordDuelResult(
  client: SupabaseClient,
  duelId: string,
  userId: string,
  result: DuelResult,
): Promise<boolean> {
  const { error } = await client.from("duel_results").insert({
    duel_id: duelId,
    user_id: userId,
    correct: result.correct,
    count: result.count,
    points: result.points,
    duration_ms: result.durationMs,
    items: result.items ?? null,
  });
  // 23505 znamená, že výsledek už je zapsaný. To není chyba, jen druhý pokus.
  if (!error || error.code === "23505") return true;
  if (error.code === "42501") return false;
  throw new Error(error.message);
}

export type DuelRecord = { wins: number; losses: number; draws: number };

/** Bilance: celková, nebo proti jednomu kamarádovi. */
export async function duelRecord(client: SupabaseClient, otherId?: string): Promise<DuelRecord> {
  const { data, error } = await client.rpc("duel_record", otherId ? { p_other: otherId } : {}).single<DuelRecord>();
  if (error) throw new Error(error.message);
  return { wins: data?.wins ?? 0, losses: data?.losses ?? 0, draws: data?.draws ?? 0 };
}

/* ---------------------------------------------------------------------------
   Liga

   Skupina dvaceti lidí v jedné divizi, řazená podle týdenních XP. První tři
   postoupí, posledních pět sestoupí. Zařazení dělá server při zápisu lekce,
   klient se jen ptá, jak to vypadá.
   ------------------------------------------------------------------------ */

export type LeagueStanding = {
  tier: number;
  season: string;
  rows: RankedEntry[];
};

export async function leagueStanding(
  client: SupabaseClient,
  userId: string,
): Promise<LeagueStanding | null> {
  const { data: own, error } = await client
    .from("stats")
    .select("league_tier, league_season, league_group")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!own?.league_group || !own.league_season) return null;

  const [members, scores] = await Promise.all([
    client.from("league_members").select("user_id").eq("group_id", own.league_group),
    client.from("weekly_xp").select("user_id, xp").eq("week_start", own.league_season),
  ]);
  if (members.error) throw new Error(members.error.message);
  if (scores.error) throw new Error(scores.error.message);

  const ids = (members.data ?? []).map((row) => row.user_id);
  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id, handle, tone")
    .in("id", ids);
  if (profileError) throw new Error(profileError.message);
  rememberTones(profiles ?? []);

  const handles = new Map((profiles ?? []).map((profile) => [profile.id, profile.handle]));
  const xpByUser = new Map((scores.data ?? []).map((row) => [row.user_id, Number(row.xp ?? 0)]));

  return {
    tier: own.league_tier ?? 1,
    season: own.league_season,
    rows: rankLeague(
      ids.map((id) => ({ userId: id, handle: handles.get(id) ?? "", xp: xpByUser.get(id) ?? 0 })),
    ),
  };
}

/* ---------------------------------------------------------------------------
   Dary

   Prášky zůstávají v telefonu, na server jde jen událost „poslal jsem
   kamarádovi ochranu série“. Strop jeden dar za týden a podmínku, že
   odesílatel sám něco odehrál, drží politiky v databázi — aplikace je jen
   ukazuje, nevynucuje.
   ------------------------------------------------------------------------ */

export type ReceivedGift = { id: string; fromHandle: string; createdAt: string };

export type GiftResult = { ok: true } | { ok: false; reason: "usedUp" | "refused" };

export async function sendGift(
  client: SupabaseClient,
  userId: string,
  recipientId: string,
): Promise<GiftResult> {
  const { error } = await client.from("gifts").insert({ sender: userId, recipient: recipientId });
  if (!error) return { ok: true };
  // Jedinečnost (odesílatel, týden): tenhle týden už dar poslal.
  if (error.code === "23505") return { ok: false, reason: "usedUp" };
  // Politika odmítla: nepotvrzený kamarád nebo účet bez jediné dohrané lekce.
  if (error.code === "42501") return { ok: false, reason: "refused" };
  throw new Error(error.message);
}

/** Poslal už tenhle týden dar? Podle toho se tlačítko nabídne, nebo ne. */
export async function giftSentThisWeek(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from("gifts")
    .select("id")
    .eq("sender", userId)
    .eq("week", weekStart())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

/** Dary, které na uživatele čekají. Vyzvednuté se už nevracejí. */
export async function pendingGifts(client: SupabaseClient, userId: string): Promise<ReceivedGift[]> {
  const { data, error } = await client
    .from("gifts")
    .select("id, sender, created_at")
    .eq("recipient", userId)
    .is("claimed_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id, handle, tone")
    .in("id", rows.map((row) => row.sender));
  if (profileError) throw new Error(profileError.message);
  rememberTones(profiles ?? []);

  const handles = new Map((profiles ?? []).map((profile) => [profile.id, profile.handle]));
  return rows.map((row) => ({
    id: row.id,
    fromHandle: handles.get(row.sender) ?? "",
    createdAt: row.created_at,
  }));
}

/**
 * Označí dar za vyzvednutý. Zapisuje se až po tom, co si zařízení ochranu
 * připsalo — kdyby se to obrátilo, výpadek uprostřed by dar spolkl.
 */
export async function claimGift(client: SupabaseClient, giftId: string): Promise<void> {
  const { error } = await client
    .from("gifts")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", giftId);
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------------------------------
   Přátelé: profil, odebrání

   Skóre (`stats`, `weekly_xp`), přezdívky a odznaky jsou mezi přihlášenými
   veřejné. Úspěšnost napoprvé ne: tu server nikomu jinému nevydá
   (migrace 0012) — kamarádi vidí snahu, chyby patří studentovi.
   ------------------------------------------------------------------------ */

export type FriendSummary = {
  userId: string;
  handle: string;
  /** Kdy se z žádosti stalo přátelství. */
  since: string | null;
  streakDays: number;
  lastLessonDay: string | null;
  xpTotal: number;
  xpWeek: number;
  /** Vnitřní číslo ligy (1 nejnižší). */
  tier: number;
  /** Dosažené stupně odznaků, jak si je zapsalo kamarádovo zařízení. */
  badges: BadgeLevels;
};

export async function friendSummaries(client: SupabaseClient, userId: string): Promise<FriendSummary[]> {
  const { data: links, error } = await client
    .from("friendships")
    .select("requester, addressee, responded_at")
    .eq("status", "accepted");
  if (error) throw new Error(error.message);

  const since = new Map(
    (links ?? []).map((row) => [row.requester === userId ? row.addressee : row.requester, row.responded_at as string | null]),
  );
  const ids = [...since.keys()];
  if (ids.length === 0) return [];

  const [profiles, stats, weekly] = await Promise.all([
    client.from("profiles").select("id, handle, badges, tone").in("id", ids),
    client.from("stats").select("user_id, xp_total, streak_days, last_lesson_day, league_tier").in("user_id", ids),
    client.from("weekly_xp").select("user_id, xp").eq("week_start", weekStart()).in("user_id", ids),
  ]);
  for (const result of [profiles, stats, weekly]) if (result.error) throw new Error(result.error.message);
  rememberTones(profiles.data ?? []);

  const statsBy = new Map((stats.data ?? []).map((row) => [row.user_id, row]));
  const weekBy = new Map((weekly.data ?? []).map((row) => [row.user_id, Number(row.xp ?? 0)]));

  return (profiles.data ?? [])
    .map((profile) => {
      const row = statsBy.get(profile.id);
      return {
        userId: profile.id,
        handle: profile.handle,
        since: since.get(profile.id) ?? null,
        streakDays: row?.streak_days ?? 0,
        lastLessonDay: row?.last_lesson_day ?? null,
        xpTotal: row?.xp_total ?? 0,
        xpWeek: weekBy.get(profile.id) ?? 0,
        tier: row?.league_tier ?? 1,
        badges: parseBadgeLevels(profile.badges),
      };
    })
    .sort((a, b) => a.handle.localeCompare(b.handle));
}

/** Zapíše do profilu dosažené stupně odznaků, ať je kamarádi vidí. */
export async function publishBadges(client: SupabaseClient, userId: string, levels: BadgeLevels): Promise<void> {
  const { error } = await client.from("profiles").update({ badges: levels }).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function removeFriend(client: SupabaseClient, userId: string, otherId: string): Promise<void> {
  const { error } = await client
    .from("friendships")
    .delete()
    .or(`and(requester.eq.${userId},addressee.eq.${otherId}),and(requester.eq.${otherId},addressee.eq.${userId})`);
  if (error) throw new Error(error.message);
}

/** Odmítnutí žádosti o přátelství je smazání (migrace 0001). */
export async function declineFriend(client: SupabaseClient, userId: string, requester: string): Promise<void> {
  const { error } = await client.from("friendships").delete().eq("requester", requester).eq("addressee", userId);
  if (error) throw new Error(error.message);
}

/** Kolik ochran série uživatel daroval. Pro odznak Kolega. */
export async function giftsSentCount(client: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await client
    .from("gifts")
    .select("id", { count: "exact", head: true })
    .eq("sender", userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type LeagueWeek = { season: string; tier: number; rank: number; size: number };

/** Minulé týdny v lize. Z nich je výsledek týdne a ligové odznaky. */
export async function leagueHistory(client: SupabaseClient): Promise<LeagueWeek[]> {
  const { data, error } = await client.rpc("league_history");
  if (error) throw new Error(error.message);
  return (data ?? []) as LeagueWeek[];
}
