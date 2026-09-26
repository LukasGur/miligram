-- Souboje s pravidly, profil přítele a varování před sestupem.
--
-- Dosavadní souboj byl jen sdílený identifikátor lekce: nešel odmítnout,
-- neměl lhůtu, remíza byla častá a výsledek soupeře byl vidět dřív, než
-- člověk sám hrál. Pravidla, jak je popisuje docs/stav.md:
--
--  - Vyzývající zvolí téma (mix nebo kategorie). Oba dostanou tytéž
--    příklady, lekce se sestaví ze (souboj, téma) na obou zařízeních.
--  - Vyzývající smí hrát hned. Vyzvaný má 48 h na přijetí nebo odmítnutí;
--    nepřijatá výzva propadne a nikdo nic nezíská.
--  - Po přijetí běží nových 48 h pro oba. Kdo nedohraje, prohrává
--    kontumačně, ale jen když ten druhý dohrál. Nedohraje-li nikdo,
--    souboj propadne.
--  - Bod za příklad správně napoprvé bez nápovědy. Při shodě rozhoduje
--    kratší celkový čas; rozdíl pod sekundu je remíza.
--  - Mezi dvojicí smí být jen jeden otevřený souboj.
--  - Výsledek soupeře je vidět až po vlastním dohrání.
--
-- Odměna za výhru jsou pastilky, a ty žijí v telefonu (migrace 0006):
-- server jen rozhodne, kdo vyhrál, a zařízení si výhru připíše samo.

-- ---------------------------------------------------------------------------
-- Souboj
-- ---------------------------------------------------------------------------

alter table public.duels
  add column topic text not null default 'mix',
  add column status text not null default 'offered',
  add column accepted_at timestamptz,
  add column resolved_at timestamptz,
  add column winner uuid references auth.users on delete set null,
  add column forfeit boolean not null default false,
  -- Kdo už odehrál. Drží se tady, ne jen v duel_results: politika pro
  -- čtení výsledků se na ně ptá, a kdyby se ptala tabulky, kterou sama
  -- hlídá, zacyklila by se.
  add column challenger_played boolean not null default false,
  add column opponent_played boolean not null default false,
  -- Připomínka konce lhůty odešla. Jednou za souboj.
  add column reminded boolean not null default false,
  add constraint duels_topic check (topic in (
    'mix', 'zaklad', 'hmotnost', 'povrch', 'redeni', 'rekonstituce', 'infuze',
    'vazoaktivni', 'prevody', 'inzulin', 'renalni', 'pediatrie', 'onkologie'
  )),
  add constraint duels_status check (status in ('offered', 'accepted', 'declined', 'expired', 'finished', 'void'));

comment on column public.duels.status is
  'offered → accepted | declined | expired; accepted → finished | void. Mění jen funkce níže.';

alter table public.duel_results
  -- Body bez nápovědy. `correct` zůstává kvůli starším verzím aplikace
  -- a notifikacím, rozhoduje se podle `points`.
  add column points integer,
  add column duration_ms integer,
  add constraint duel_results_points check (points is null or points between 0 and count),
  add constraint duel_results_duration check (duration_ms is null or duration_ms between 0 and 86400000);

-- Staré souboje neznaly přijetí. Dohrané se uzavřou podle bodů, otevřené
-- se berou jako přijaté a dostanou celou lhůtu od nasazení.
update public.duel_results set points = correct where points is null;

update public.duels d set
  challenger_played = exists (select 1 from public.duel_results r where r.duel_id = d.id and r.user_id = d.challenger),
  opponent_played = exists (select 1 from public.duel_results r where r.duel_id = d.id and r.user_id = d.opponent);

update public.duels set status = 'accepted', accepted_at = now()
where not (challenger_played and opponent_played);

-- Víc otevřených soubojů mezi dvojicí: zůstane nejnovější.
update public.duels d set status = 'void', resolved_at = now()
where d.status = 'accepted'
  and exists (
    select 1 from public.duels newer
    where newer.status = 'accepted'
      and least(newer.challenger, newer.opponent) = least(d.challenger, d.opponent)
      and greatest(newer.challenger, newer.opponent) = greatest(d.challenger, d.opponent)
      and newer.created_at > d.created_at
  );

create unique index duels_one_open_per_pair
  on public.duels (least(challenger, opponent), greatest(challenger, opponent))
  where status in ('offered', 'accepted');

create index duels_open_deadline on public.duels (status, accepted_at, created_at)
  where status in ('offered', 'accepted');

/**
 * Kdo vyhrál: 1 první, -1 druhý, 0 remíza.
 *
 * POZOR: pravidlo musí souhlasit s duelOutcome v src/core/duel.ts. Body
 * rozhodují, při shodě kratší čas, rozdíl pod sekundu je remíza. Čas bez
 * údaje (starší verze aplikace) čas nerozhoduje.
 */
create function public.duel_outcome(a_points integer, a_ms integer, b_points integer, b_ms integer)
  returns integer
  language sql
  immutable
  set search_path = ''
as $$
  select case
    when a_points > b_points then 1
    when a_points < b_points then -1
    when a_ms is null or b_ms is null then 0
    when b_ms - a_ms >= 1000 then 1
    when a_ms - b_ms >= 1000 then -1
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
-- Politiky
-- ---------------------------------------------------------------------------

drop policy "vyzvat smí jen kamarád" on public.duels;
create policy "vyzvat smí jen kamarád"
  on public.duels for insert
  to authenticated
  with check (
    challenger = (select auth.uid())
    and status = 'offered'
    and accepted_at is null
    and resolved_at is null
    and winner is null
    and not forfeit
    and not challenger_played
    and not opponent_played
    and not reminded
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = challenger and f.addressee = opponent)
          or (f.requester = opponent and f.addressee = challenger))
    )
  );

-- Zrušit jde jen výzvu, kterou ještě nikdo nepřijal.
drop policy "souboj smí zrušit ten, kdo ho vypsal" on public.duels;
create policy "nepřijatou výzvu smí zrušit ten, kdo ji vypsal"
  on public.duels for delete
  to authenticated
  using (challenger = (select auth.uid()) and status = 'offered');

-- Výsledek soupeře až po vlastním dohrání, nebo když je souboj rozhodnutý.
drop policy "výsledky vidí obě strany souboje" on public.duel_results;
create policy "výsledek soupeře až po vlastním"
  on public.duel_results for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.duels d
      where d.id = duel_id
        and (
          (d.challenger = (select auth.uid()) and (d.challenger_played or d.status = 'finished'))
          or (d.opponent = (select auth.uid()) and (d.opponent_played or d.status = 'finished'))
        )
    )
  );

-- Vyzývající hraje od výzvy do konce lhůty po přijetí, vyzvaný jen po
-- přijetí. Po lhůtě se nezapíše nic — souboj už rozhodla kontumace.
drop policy "vlastní výsledek zapíše jen jeho autor" on public.duel_results;
create policy "vlastní výsledek zapíše jen jeho autor"
  on public.duel_results for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.duels d
      where d.id = duel_id
        and (
          (d.challenger = (select auth.uid())
            and ((d.status = 'offered' and d.created_at > now() - interval '48 hours')
              or (d.status = 'accepted' and d.accepted_at > now() - interval '48 hours')))
          or (d.opponent = (select auth.uid())
            and d.status = 'accepted' and d.accepted_at > now() - interval '48 hours')
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Přijetí a odmítnutí
-- ---------------------------------------------------------------------------

/**
 * Odpověď na výzvu. Jen vyzvaný, jen na čekající výzvu a jen v její lhůtě.
 * Vrací nový stav, nebo null, když odpovídat nebylo na co.
 */
create function public.respond_duel(p_duel uuid, p_accept boolean)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  duel public.duels;
begin
  update public.duels
  set status = case when p_accept then 'accepted' else 'declined' end,
      accepted_at = case when p_accept then now() end,
      resolved_at = case when p_accept then null else now() end
  where id = p_duel
    and opponent = (select auth.uid())
    and status = 'offered'
    and created_at > now() - interval '48 hours'
  returning * into duel;

  if duel.id is null then
    return null;
  end if;

  perform public.enqueue_push(
    duel.challenger,
    case when p_accept then 'duelAccepted' else 'duelDeclined' end,
    jsonb_build_object('handle', public.handle_of(duel.opponent)),
    'duel:' || duel.id
  );
  return duel.status;
end;
$$;

revoke execute on function public.respond_duel(uuid, boolean) from public, anon;
grant execute on function public.respond_duel(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Výsledek
-- ---------------------------------------------------------------------------

/**
 * Zapsaný výsledek: poznamenat, kdo odehrál, a když už oba, rozhodnout.
 *
 * Nahrazuje push_on_duel_result z migrace 0008. Soupeř, který ještě
 * nehrál, se dozví jen „má odehráno“ — bez skóre, to je zapečetěné.
 */
create or replace function public.push_on_duel_result()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  duel public.duels;
  other uuid;
  theirs public.duel_results;
  result integer;
begin
  update public.duels
  set challenger_played = challenger_played or challenger = new.user_id,
      opponent_played = opponent_played or opponent = new.user_id
  where id = new.duel_id
  returning * into duel;

  other := case when duel.challenger = new.user_id then duel.opponent else duel.challenger end;
  select * into theirs from public.duel_results where duel_id = new.duel_id and user_id = other;

  if theirs.user_id is null then
    perform public.enqueue_push(
      other,
      'duelPlayed',
      jsonb_build_object('handle', public.handle_of(new.user_id), 'stage', duel.status),
      'duel:' || new.duel_id
    );
    return new;
  end if;

  -- Oba odehráli: rozhodnuto.
  result := public.duel_outcome(
    coalesce(new.points, new.correct), new.duration_ms,
    coalesce(theirs.points, theirs.correct), theirs.duration_ms
  );

  update public.duels
  set status = 'finished',
      resolved_at = now(),
      winner = case when result = 1 then new.user_id when result = -1 then other end
  where id = new.duel_id;

  -- Kdo hrál teď, vidí výsledek v aplikaci. Zpráva jde tomu druhému.
  perform public.enqueue_push(
    other,
    'duelFinished',
    jsonb_build_object(
      'handle', public.handle_of(new.user_id),
      'mine', coalesce(theirs.points, theirs.correct),
      'theirs', coalesce(new.points, new.correct),
      'outcome', case when result = -1 then 'won' when result = 1 then 'lost' else 'draw' end
    ),
    'duel:' || new.duel_id
  );
  return new;
end;
$$;

revoke execute on function public.push_on_duel_result() from public, anon, authenticated;

/**
 * Lhůty. Běží z cronu každou minutu.
 *
 *  - Nepřijatá výzva po 48 h propadne.
 *  - Přijatá: šest hodin před koncem připomínka tomu, kdo nehrál;
 *    po 48 h kontumace, nebo propadnutí, když nehrál nikdo.
 */
create function public.resolve_duels()
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  changed integer := 0;
  added integer;
  duel public.duels;
begin
  update public.duels
  set status = 'expired', resolved_at = now()
  where status = 'offered' and created_at <= now() - interval '48 hours';
  get diagnostics added = row_count;
  changed := changed + added;

  for duel in
    update public.duels
    set reminded = true
    where status = 'accepted'
      and not reminded
      and accepted_at <= now() - interval '42 hours'
      and not (challenger_played and opponent_played)
    returning *
  loop
    if not duel.challenger_played then
      perform public.enqueue_push(duel.challenger, 'duelExpiring',
        jsonb_build_object('handle', public.handle_of(duel.opponent)), 'duel:' || duel.id);
    end if;
    if not duel.opponent_played then
      perform public.enqueue_push(duel.opponent, 'duelExpiring',
        jsonb_build_object('handle', public.handle_of(duel.challenger)), 'duel:' || duel.id);
    end if;
  end loop;

  for duel in
    update public.duels
    set status = case when challenger_played or opponent_played then 'finished' else 'void' end,
        resolved_at = now(),
        forfeit = challenger_played or opponent_played,
        winner = case
          when challenger_played then challenger
          when opponent_played then opponent
        end
    where status = 'accepted' and accepted_at <= now() - interval '48 hours'
    returning *
  loop
    changed := changed + 1;
    if duel.winner is not null then
      perform public.enqueue_push(duel.winner, 'duelForfeit',
        jsonb_build_object(
          'handle', public.handle_of(case when duel.winner = duel.challenger then duel.opponent else duel.challenger end),
          'outcome', 'won'),
        'duel:' || duel.id);
      perform public.enqueue_push(
        case when duel.winner = duel.challenger then duel.opponent else duel.challenger end,
        'duelForfeit',
        jsonb_build_object('handle', public.handle_of(duel.winner), 'outcome', 'lost'),
        'duel:' || duel.id);
    end if;
  end loop;

  return changed;
end;
$$;

revoke execute on function public.resolve_duels() from public, anon, authenticated;

-- Odebraný přítel: otevřené souboje mezi nimi propadnou.
create function public.void_duels_on_unfriend()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.duels
  set status = 'void', resolved_at = now()
  where status in ('offered', 'accepted')
    and least(challenger, opponent) = least(old.requester, old.addressee)
    and greatest(challenger, opponent) = greatest(old.requester, old.addressee);
  return old;
end;
$$;

revoke execute on function public.void_duels_on_unfriend() from public, anon, authenticated;

create trigger void_duels_on_unfriend
  after delete on public.friendships
  for each row execute function public.void_duels_on_unfriend();

-- ---------------------------------------------------------------------------
-- Čtení pro profil
-- ---------------------------------------------------------------------------

/**
 * Bilance soubojů přihlášeného uživatele, celková nebo proti jednomu
 * soupeři. Kontumace se počítá, propadlé a odmítnuté ne.
 */
create function public.duel_record(p_other uuid default null)
  returns table (wins integer, losses integer, draws integer)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    count(*) filter (where d.winner = (select auth.uid()))::integer,
    count(*) filter (where d.winner is not null and d.winner <> (select auth.uid()))::integer,
    count(*) filter (where d.winner is null)::integer
  from public.duels d
  where d.status = 'finished'
    and (select auth.uid()) in (d.challenger, d.opponent)
    and (p_other is null or p_other in (d.challenger, d.opponent));
$$;

revoke execute on function public.duel_record(uuid) from public, anon;
grant execute on function public.duel_record(uuid) to authenticated;

/**
 * Úspěšnost kamaráda podle šablon: kolik odpovědí a kolik správně
 * napoprvé. Kategorie si z šablon složí aplikace (src/core/templateCategories.ts)
 * — tabulka tam už je a druhá kopie v databázi by se rozešla.
 *
 * Jen pro sebe a potvrzené přátele. Cizí úspěšnost nevidí nikdo.
 */
create function public.friend_template_stats(p_friend uuid)
  returns table (template_id text, answered integer, correct integer)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select item->>'templateId',
         count(*)::integer,
         count(*) filter (where (item->>'correct')::boolean)::integer
  from public.lesson_events e
  cross join lateral jsonb_array_elements(e.answers) as item
  where e.user_id = p_friend
    and (
      p_friend = (select auth.uid())
      or exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.requester = p_friend and f.addressee = (select auth.uid()))
            or (f.requester = (select auth.uid()) and f.addressee = p_friend))
      )
    )
  group by 1;
$$;

revoke execute on function public.friend_template_stats(uuid) from public, anon;
grant execute on function public.friend_template_stats(uuid) to authenticated;

/**
 * Minulé týdny v lize přihlášeného uživatele: liga, pořadí a velikost
 * skupiny. Z toho se skládá výsledek minulého týdne a ligové odznaky.
 * Politika na league_members pustí jen vlastní současnou skupinu, proto
 * funkce.
 */
create function public.league_history()
  returns table (season date, tier integer, rank integer, size integer)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select mine.season, g.tier, st.rank, st.size
  from public.league_members mine
  join public.league_groups g on g.id = mine.group_id
  cross join lateral (
    select s.rank, s.size from (
      select m.user_id,
             rank() over (order by coalesce(w.xp, 0) desc, m.joined_at)::integer as rank,
             count(*) over ()::integer as size
      from public.league_members m
      left join public.weekly_xp w on w.user_id = m.user_id and w.week_start = mine.season
      where m.group_id = mine.group_id
    ) s
    where s.user_id = mine.user_id
  ) st
  where mine.user_id = (select auth.uid())
  order by mine.season;
$$;

revoke execute on function public.league_history() from public, anon;
grant execute on function public.league_history() to authenticated;

-- ---------------------------------------------------------------------------
-- Notifikace
-- ---------------------------------------------------------------------------

alter table public.push_queue drop constraint push_queue_kind;
alter table public.push_queue add constraint push_queue_kind check (kind in (
  'streak', 'lastChance',
  'duelChallenge', 'duelPlayed', 'duelFinished',
  'duelAccepted', 'duelDeclined', 'duelExpiring', 'duelForfeit',
  'friendRequest', 'friendAccepted', 'gift',
  'leagueLastDay', 'leagueResult'
));

/**
 * Pořadí ve skupině (migrace 0008) a k tomu XP posledního místa, které
 * ještě nesestupuje. Z něj se počítá, kolik chybí do bezpečí.
 */
create function public.league_position(p_user uuid, p_season date)
  returns table (rank integer, size integer, xp integer, third_xp integer, safe_xp integer)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with standings as (
    select m.user_id,
           coalesce(w.xp, 0) as xp,
           rank() over (order by coalesce(w.xp, 0) desc, m.joined_at)::integer as rank,
           row_number() over (order by coalesce(w.xp, 0) desc, m.joined_at)::integer as place,
           count(*) over ()::integer as size
    from public.league_members m
    left join public.weekly_xp w on w.user_id = m.user_id and w.week_start = p_season
    where m.group_id = (
      select m2.group_id from public.league_members m2
      where m2.season = p_season and m2.user_id = p_user
    )
  )
  select s.rank, s.size, s.xp,
         (select t.xp from standings t where t.place = 3),
         (select t.xp from standings t where t.place = s.size - 5)
  from standings s
  where s.user_id = p_user;
$$;

revoke execute on function public.league_position(uuid, date) from public, anon, authenticated;

/**
 * Připomínky podle místního času. Beze změny proti migraci 0008 až na
 * poslední den ligy: kdo je v sestupu, dozví se, kolik XP ho dostane
 * do bezpečí (`safe`).
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
    select p.user_id, 'streak' as kind, p.local_day, p.streak_now
    from pending p
    where p.streak
      and p.local_now::time >= p.reminder_time
      and p.local_now::time < p.reminder_time + interval '2 hours'
      and p.local_now::time < '21:30'
    union all
    select p.user_id, 'lastChance', p.local_day, p.streak_now
    from pending p
    where p.last_chance
      and p.streak_now >= 3
      and p.local_now::time >= '21:30'
      and p.local_now::time < '23:30'
  )
  insert into public.push_queue (user_id, kind, params, tag, day)
  select d.user_id, d.kind, jsonb_build_object('days', d.streak_now), 'streak', d.local_day
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

/**
 * Výdej fronty. Beze změny proti migraci 0008 až na to, že mezi sociální
 * zprávy patří všechny souboje (`duel%`), i ty, které přibudou.
 */
create or replace function public.claim_push_batch(p_limit integer default 200)
  returns table (
    id bigint,
    user_id uuid,
    kind text,
    params jsonb,
    tag text,
    locale text,
    subscriptions jsonb
  )
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.push_queue q
  set sent_at = now(),
      outcome = case
        when not exists (select 1 from public.push_subscriptions s where s.user_id = q.user_id) then 'noDevice'
        else 'disabled'
      end
  from public.notification_prefs p
  where q.sent_at is null
    and q.not_before <= now()
    and p.user_id = q.user_id
    and (
      not exists (select 1 from public.push_subscriptions s where s.user_id = q.user_id)
      or (q.kind = 'streak' and not p.streak)
      or (q.kind = 'lastChance' and not p.last_chance)
      or ((q.kind like 'duel%' or q.kind in ('friendRequest', 'friendAccepted', 'gift')) and not p.social)
      or (q.kind in ('leagueLastDay', 'leagueResult') and not p.league)
    );

  update public.push_queue q
  set sent_at = now(), outcome = 'noDevice'
  where q.sent_at is null
    and q.not_before <= now()
    and not exists (select 1 from public.push_subscriptions s where s.user_id = q.user_id);

  update public.push_queue q
  set sent_at = now(), outcome = 'capped'
  from public.notification_prefs p
  where q.sent_at is null
    and q.not_before <= now()
    and p.user_id = q.user_id
    and q.kind not in ('streak', 'lastChance')
    and (
      select count(*) from public.push_queue done
      where done.user_id = q.user_id
        and done.outcome = 'sent'
        and done.kind not in ('streak', 'lastChance')
        and done.sent_at >= ((now() at time zone p.time_zone)::date::timestamp at time zone p.time_zone)
    ) >= 4;

  return query
  with picked as (
    select q.id
    from public.push_queue q
    left join public.notification_prefs p on p.user_id = q.user_id
    where q.sent_at is null
      and q.not_before <= now()
      and (q.claimed_at is null or q.claimed_at < now() - interval '5 minutes')
      and (
        q.kind in ('streak', 'lastChance')
        or (now() at time zone coalesce(p.time_zone, 'Europe/Prague'))::time between '08:00' and '21:45'
      )
    order by q.not_before
    limit p_limit
    for update of q skip locked
  ),
  claimed as (
    update public.push_queue q
    set claimed_at = now(), attempts = q.attempts + 1
    from picked
    where q.id = picked.id
    returning q.*
  )
  select c.id, c.user_id, c.kind, c.params, c.tag,
         coalesce(p.locale, 'cs'),
         (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
          from public.push_subscriptions s where s.user_id = c.user_id)
  from claimed c
  left join public.notification_prefs p on p.user_id = c.user_id;
end;
$$;

revoke execute on function public.enqueue_reminders() from public, anon, authenticated;
revoke execute on function public.claim_push_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;

-- Lhůty soubojů se hlídají se stejnou minutovou úlohou jako notifikace:
-- rozhodnutí padne dřív, než se rozešle, co z něj plyne.
select cron.unschedule('push-minute');
select cron.schedule('push-minute', '* * * * *', $$
  select public.resolve_duels();
  select public.enqueue_reminders();
  select public.dispatch_push();
$$);
