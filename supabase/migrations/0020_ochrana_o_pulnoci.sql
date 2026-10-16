-- Ochrana série se spotřebuje o půlnoci.
--
-- Dřív se ochrana odečetla, až když se student druhý den vrátil a dohrál
-- lekci. Do té doby „držela“ vynechaný den a v zásobách svítila jako
-- nepoužitá, a když nepřišel ani druhý den, série spadla a ochrana zůstala.
-- Notifikace přitom psaly opak („jinak ji série dnes spotřebuje“).
--
-- Teď každý vynechaný den spotřebuje jednu ochranu v okamžiku, kdy skončí
-- (settleStreak v src/core/economy.ts). Telefon o půlnoci neběží, takže to
-- zapíše při příštím otevření. Server do té doby počítá totéž sám:
--
-- 1. streak_now: série a zbylé ochrany dnes. Vynechaný den pokryje jen
--    ochrana, kterou student měl, když den skončil. Koupená až potom
--    spadlou sérii nevzkřísí, stejně jako v telefonu.
-- 2. Připomínky dostanou skutečný zbytek ochran, ne zásobu z minula.
-- 3. Kamarádi dostanou sérii hotovou (friend_streaks), ne den poslední
--    lekce. Z něj se dalo vyčíst, že sérii drží ochrana, a ta je soukromá
--    stejně jako pastilky.

-- ---------------------------------------------------------------------------
-- 1. Série dnes
-- ---------------------------------------------------------------------------

/**
 * Série a zbylé ochrany v den `p_today`. `p_through` je den, kam série
 * sahá včetně pokrytých dní. Každý vynechaný den mezi ním a dneškem
 * spotřebuje ochranu, kterou uživatel vlastnil o půlnoci na konci toho dne.
 * Ochran je nejvýš dvě, takže po třech vynechaných dnech není co počítat.
 */
create function public.streak_now(p_user uuid, p_days integer, p_through date, p_today date, p_tz text)
  returns table (streak integer, freezes integer)
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  balance integer;
  owned integer;
  used integer := 0;
  missed date;
begin
  select coalesce(sum(w.freezes), 0)::integer into balance
    from public.wallet_events w
   where w.user_id = p_user;

  if p_through is null or coalesce(p_days, 0) <= 0 or p_through < p_today - 3 then
    return query select 0, greatest(balance, 0);
    return;
  end if;

  missed := p_through + 1;
  while missed < p_today loop
    select coalesce(sum(w.freezes), 0)::integer into owned
      from public.wallet_events w
     where w.user_id = p_user
       and w.occurred_at < ((missed + 1)::timestamp at time zone p_tz);
    if owned - used < 1 then
      return query select 0, greatest(balance - used, 0);
      return;
    end if;
    used := used + 1;
    missed := missed + 1;
  end loop;

  return query select p_days, greatest(balance - used, 0);
end;
$$;

revoke execute on function public.streak_now(uuid, integer, date, date, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Připomínky
-- ---------------------------------------------------------------------------

-- Proti migraci 0018 se mění jen série a zbylé ochrany; kdy a komu, zůstává.
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
    select l.*, n.streak as streak_now, n.freezes as freezes_now
    from local l
    cross join lateral public.streak_now(l.user_id, l.streak_days, l.last_lesson_day, l.local_day, l.time_zone) n
    where coalesce(l.last_lesson_day < l.local_day, true)
      and not exists (
        select 1 from public.lesson_events e
        where e.user_id = l.user_id
          and e.finished_at >= (l.local_day::timestamp at time zone l.time_zone)
      )
  ),
  due as (
    select p.user_id, 'streak' as kind, p.local_day, p.local_now, p.streak_now,
           p.streak_days, p.freezes_now, p.streak_best, p.last_lesson_day
    from pending p
    where p.streak
      and p.local_now::time >= p.reminder_time
      and p.local_now::time < p.reminder_time + interval '2 hours'
      and p.local_now::time < '21:30'
    union all
    select p.user_id, 'lastChance', p.local_day, p.local_now, p.streak_now,
           p.streak_days, p.freezes_now, p.streak_best, p.last_lesson_day
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
             jsonb_build_object('days', d.streak_now, 'freezes', d.freezes_now)
           else
             jsonb_strip_nulls(jsonb_build_object(
               'days', d.streak_now,
               'freezes', d.freezes_now,
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

-- ---------------------------------------------------------------------------
-- 3. Kamarádi
-- ---------------------------------------------------------------------------

/**
 * Série kamarádů, jak ji vidí oni sami. Dnešek podle jejich časového
 * pásma, jinak podle Prahy. Ochrany se nevracejí: kamarádi vidí sérii,
 * ne čím se drží.
 */
create function public.friend_streaks()
  returns table (user_id uuid, streak integer)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select s.user_id, n.streak
    from public.stats s
    left join public.notification_prefs p on p.user_id = s.user_id
    cross join lateral public.streak_now(
      s.user_id,
      s.streak_days,
      coalesce(s.streak_through, s.last_lesson_day),
      (now() at time zone coalesce(p.time_zone, 'Europe/Prague'))::date,
      coalesce(p.time_zone, 'Europe/Prague')
    ) n
   where exists (
     select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = (select auth.uid()) and f.addressee = s.user_id)
          or (f.addressee = (select auth.uid()) and f.requester = s.user_id))
   );
$$;

revoke execute on function public.friend_streaks() from public, anon;
grant execute on function public.friend_streaks() to authenticated;

-- Den poslední lekce a kam série sahá už nikdo cizí nečte. Zbytek
-- (XP, liga) zůstává veřejný, jak byl.
revoke select on public.stats from authenticated;
grant select (user_id, xp_total, lessons, league_tier, league_season, league_group, updated_at)
  on public.stats to authenticated;
