-- Pestřejší notifikace.
--
-- Připomínka série chodila s jednou ze tří vět a varianta se brala
-- z čísla řádku ve frontě, společné pro všechny: za patnáct připomínek
-- přišla desetkrát táž věta. Varianty a výběr situace jsou teď
-- v Edge Function (supabase/functions/push/compose.ts); databáze k tomu
-- posílá, co o příjemci ví:
--
-- - dřívější rekord série (`best`) — posílá ho telefon jako sérii samu,
-- - jestli jde spadlou sérii ještě obnovit (`lost`, `deadline`),
-- - rozehraný souboj, ve kterém je příjemce na tahu (`duel`),
-- - pozici v lize ve všední den (`rank`, `size`, `gap`, `safe`),
-- - místní hodinu a den v týdnu (texty ráno, večer, o víkendu).
--
-- Úspěšnost ani chyby se do textů nedostanou: notifikaci může číst
-- kdokoli přes rameno (CLAUDE.md, „Co vidí kamarádi“).

-- Nejdelší dřívější série bez té současné (src/core/economy.ts,
-- previousBest). Null u starších verzí aplikace: rekord se pak nehlásí.
alter table public.notification_prefs add column streak_best integer;
alter table public.notification_prefs add constraint notification_prefs_streak_best
  check (streak_best is null or streak_best between 0 and 100000);

/**
 * Co se k denní připomínce přidá podle situace příjemce.
 *
 * Obnova kopíruje repairOffer v src/core/economy.ts pro případ, kdy
 * student po ztrátě ještě nehrál: série aspoň 7 dní, chybí jeden nebo
 * dva dny, lhůta do konce druhého dne po ztrátě, placené obnovení nejvýš
 * jednou za 30 dní a na cenu (REPAIR_COST, 200 pastilek) musí stačit
 * zůstatek. Kdo by na obnovu neměl, dostane připomínku nové série:
 * nabízet, co si nemůže koupit, by jen dráždilo.
 */
create function public.reminder_context(
  p_user uuid,
  p_today date,
  p_streak_now integer,
  p_streak_days integer,
  p_last_day date
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  context jsonb := '{}';
  opponent text;
  standing record;
begin
  if p_streak_now = 0
     and p_streak_days >= 7
     and p_last_day is not null
     and p_today - p_last_day between 2 and 3
     and not exists (
       select 1 from public.wallet_events w
        where w.user_id = p_user and w.kind = 'repair' and w.pills < 0
          and w.created_at > now() - interval '30 days'
     )
     and (select coalesce(sum(w.pills), 0) from public.wallet_events w where w.user_id = p_user) >= 200
  then
    context := context || jsonb_build_object(
      'lost', p_streak_days,
      'deadline', case when p_today - p_last_day = 3 then 'today' else 'tomorrow' end
    );
  end if;

  select public.handle_of(case when d.challenger = p_user then d.opponent else d.challenger end)
    into opponent
    from public.duels d
   where d.status = 'accepted'
     and ((d.challenger = p_user and not d.challenger_played)
       or (d.opponent = p_user and not d.opponent_played))
   order by d.accepted_at
   limit 1;
  if opponent is not null then
    context := context || jsonb_build_object('duel', opponent);
  end if;

  -- V neděli má liga vlastní zprávu (leagueLastDay).
  if extract(isodow from p_today) < 7 then
    select * into standing from public.league_position(p_user, public.week_start(p_today));
    if found and standing.rank is not null then
      context := context || jsonb_build_object(
        'rank', standing.rank,
        'size', standing.size,
        'gap', case when standing.size > 8 and standing.rank > 3 then greatest(standing.third_xp - standing.xp + 1, 1) else 0 end,
        'safe', case when standing.size > 8 and standing.rank > standing.size - 5 then greatest(standing.safe_xp - standing.xp + 1, 1) else 0 end
      );
    end if;
  end if;

  return context;
end;
$$;

revoke execute on function public.reminder_context(uuid, date, integer, integer, date) from public, anon, authenticated;

/**
 * Zařazení připomínek. Proti migraci 0010 se mění jen parametry série
 * a poslední šance; kdy a komu, zůstává.
 */
create or replace function public.enqueue_reminders()
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  queued integer := 0;
  added integer;
begin
  -- Série a poslední šance.
  with local as (
    select p.*,
           (now() at time zone p.time_zone) as local_now,
           (now() at time zone p.time_zone)::date as local_day
    from public.notification_prefs p
    where (p.streak or p.last_chance)
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.user_id)
  ),
  pending as (
    select l.*,
           public.visible_streak(l.streak_days, l.last_lesson_day, l.streak_freezes, l.local_day) as streak_now
    from local l
    where coalesce(l.last_lesson_day < l.local_day, true)
      and not exists (
        select 1 from public.lesson_events e
        where e.user_id = l.user_id
          and e.finished_at >= (l.local_day::timestamp at time zone l.time_zone)
      )
  ),
  due as (
    select p.user_id, 'streak' as kind, p.local_day, p.local_now, p.streak_now,
           p.streak_days, p.streak_freezes, p.streak_best, p.last_lesson_day
    from pending p
    where p.streak
      and p.local_now::time >= p.reminder_time
      and p.local_now::time < p.reminder_time + interval '2 hours'
      and p.local_now::time < '21:30'
    union all
    select p.user_id, 'lastChance', p.local_day, p.local_now, p.streak_now,
           p.streak_days, p.streak_freezes, p.streak_best, p.last_lesson_day
    from pending p
    where p.last_chance
      and p.streak_now >= 3
      and p.local_now::time >= '21:30'
      and p.local_now::time < '23:30'
  )
  insert into public.push_queue (user_id, kind, params, tag, day)
  select d.user_id, d.kind,
         case
           when d.kind = 'lastChance' then
             jsonb_build_object('days', d.streak_now, 'freezes', d.streak_freezes)
           else
             jsonb_strip_nulls(jsonb_build_object(
               'days', d.streak_now,
               'freezes', d.streak_freezes,
               'best', d.streak_best,
               'hour', extract(hour from d.local_now)::integer,
               'weekday', extract(isodow from d.local_day)::integer
             )) || public.reminder_context(d.user_id, d.local_day, d.streak_now, d.streak_days, d.last_lesson_day)
         end,
         'streak', d.local_day
  from due d
  on conflict (user_id, kind, day) where day is not null do nothing;
  get diagnostics added = row_count;
  queued := queued + added;

  -- Liga: neděle večer poslední den, pondělí ráno výsledek.
  with local as (
    select p.user_id,
           (now() at time zone p.time_zone) as local_now,
           (now() at time zone p.time_zone)::date as local_day
    from public.notification_prefs p
    where p.league
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.user_id)
  ),
  last_day as (
    select l.user_id, l.local_day, st.*
    from local l
    cross join lateral public.league_position(l.user_id, public.week_start(l.local_day)) st
    where extract(isodow from l.local_day) = 7
      and l.local_now::time >= '18:00' and l.local_now::time < '20:00'
  ),
  result as (
    select l.user_id, l.local_day, st.*, s.league_tier, s.league_season
    from local l
    cross join lateral public.league_position(l.user_id, public.week_start(l.local_day) - 7) st
    join public.stats s on s.user_id = l.user_id
    where extract(isodow from l.local_day) = 1
      and l.local_now::time >= '09:00' and l.local_now::time < '11:00'
  )
  insert into public.push_queue (user_id, kind, params, tag, day)
  select user_id, 'leagueLastDay',
         jsonb_build_object(
           'rank', rank,
           'size', size,
           'gap', case when size > 8 and rank > 3 then greatest(third_xp - xp + 1, 1) else 0 end,
           -- Do bezpečí chybí jen tomu, kdo je v sestupové zóně.
           'safe', case when size > 8 and rank > size - 5 then greatest(safe_xp - xp + 1, 1) else 0 end
         ),
         'league', local_day
  from last_day
  union all
  select user_id, 'leagueResult',
         jsonb_build_object(
           'rank', rank,
           'size', size,
           'move', case
             when size <= 8 then 'stay'
             when rank <= 3 then 'up'
             when rank > size - 5 then 'down'
             else 'stay'
           end,
           'tier', case
             when league_season = public.week_start(local_day) then league_tier
             when size <= 8 then league_tier
             when rank <= 3 then least(league_tier + 1, 5)
             when rank > size - 5 then greatest(league_tier - 1, 1)
             else league_tier
           end
         ),
         'league', local_day
  from result
  on conflict (user_id, kind, day) where day is not null do nothing;
  get diagnostics added = row_count;
  queued := queued + added;

  return queued;
end;
$$;

revoke execute on function public.enqueue_reminders() from public, anon, authenticated;
