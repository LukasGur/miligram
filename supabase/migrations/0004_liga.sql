-- Týdenní liga.
--
-- Uživatelé se každý týden rozdělí do skupin po dvaceti v rámci divize
-- a měří se týdenními XP. Na konci týdne první tři postoupí, posledních
-- pět sestoupí.
--
-- Bez naplánované úlohy. Přeřazení se počítá ve chvíli, kdy se uživatel
-- v novém týdnu poprvé ozve: podívá se na svůj výsledek v minulém týdnu
-- a podle něj se zařadí. Naplánovaná úloha by musela běžet i pro účty,
-- které se týden neozvaly, a musela by se hlídat — tohle se opraví samo.

alter table public.stats
  add column league_tier integer not null default 1,
  add column league_season date,
  add column league_group uuid;

comment on column public.stats.league_tier is
  'Divize 1 (nejnižší) až 5 (nejvyšší). Drží se mezi týdny.';

create table public.league_groups (
  id uuid primary key default gen_random_uuid(),
  season date not null,
  tier integer not null,
  created_at timestamptz not null default now(),
  constraint league_groups_tier check (tier between 1 and 5)
);

create index league_groups_open on public.league_groups (season, tier);

create table public.league_members (
  season date not null,
  user_id uuid not null references auth.users on delete cascade,
  group_id uuid not null references public.league_groups on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (season, user_id)
);

create index league_members_group on public.league_members (group_id);

alter table public.league_groups enable row level security;
alter table public.league_members enable row level security;

-- Vidět je vlastní skupina, ne celá liga. Porovnání se dvaceti lidmi má
-- smysl, výpis všech uživatelů aplikace ne.
--
-- Skupina se čte ze `stats`, ne z `league_members`: politika, která se ptá
-- na tutéž tabulku, kterou hlídá, se zacyklí.
create policy "vlastní skupinu vidí její členové"
  on public.league_members for select
  to authenticated
  using (group_id = (select s.league_group from public.stats s where s.user_id = (select auth.uid())));

create policy "vlastní skupinu vidí její členové"
  on public.league_groups for select
  to authenticated
  using (id = (select s.league_group from public.stats s where s.user_id = (select auth.uid())));

-- Zapisovat do ligy smí jen spouštěč níže; politika pro zápis neexistuje.

/**
 * Pondělí týdne, do kterého datum spadá.
 */
create function public.week_start(moment date)
  returns date
  language sql
  immutable
  set search_path = ''
as $$
  select moment - ((extract(isodow from moment)::integer - 1));
$$;

/**
 * Zařadí uživatele do ligy pro daný týden.
 *
 * Když už zařazený je, nedělá nic. Jinak nejdřív vyhodnotí minulý týden
 * (postup, sestup, nebo setrvání) a pak ho posadí do skupiny, která má
 * místo — nebo založí novou.
 */
create function public.ensure_league_membership(p_user uuid, p_season date)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  current_tier integer;
  previous_season date := p_season - 7;
  standing integer;
  group_size integer;
  target uuid;
begin
  if exists (select 1 from public.league_members m where m.season = p_season and m.user_id = p_user) then
    return;
  end if;

  select coalesce(league_tier, 1) into current_tier from public.stats where user_id = p_user;
  current_tier := coalesce(current_tier, 1);

  -- Vyhodnocení minulého týdne: pořadí ve skupině podle týdenních XP.
  select rank, total into standing, group_size
  from (
    select m.user_id,
           rank() over (order by coalesce(w.xp, 0) desc, m.joined_at) as rank,
           count(*) over () as total
    from public.league_members m
    left join public.weekly_xp w on w.user_id = m.user_id and w.week_start = previous_season
    where m.group_id = (
      select m2.group_id from public.league_members m2
      where m2.season = previous_season and m2.user_id = p_user
    )
  ) as standings
  where user_id = p_user;

  if standing is not null then
    if standing <= 3 then
      current_tier := least(current_tier + 1, 5);
    elsif standing > group_size - 5 then
      current_tier := greatest(current_tier - 1, 1);
    end if;
  end if;

  -- Skupina s volným místem, jinak nová. Dvacet lidí je tak akorát:
  -- na menší skupinu se pořadí mění příliš skokem, na větší se nedá dohlédnout.
  select g.id into target
  from public.league_groups g
  where g.season = p_season
    and g.tier = current_tier
    and (select count(*) from public.league_members m where m.group_id = g.id) < 20
  order by g.created_at
  limit 1;

  if target is null then
    insert into public.league_groups (season, tier) values (p_season, current_tier) returning id into target;
  end if;

  insert into public.league_members (season, user_id, group_id) values (p_season, p_user, target);

  update public.stats
  set league_tier = current_tier, league_season = p_season, league_group = target
  where user_id = p_user;
end;
$$;

revoke execute on function public.ensure_league_membership(uuid, date) from public, anon, authenticated;
revoke execute on function public.week_start(date) from public, anon, authenticated;

/**
 * Doplnění do spouštěče skóre: kdo dohrál lekci, je v lize.
 */
create or replace function public.apply_lesson_event()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  gained integer := public.lesson_xp(new.answers);
  day date := (new.finished_at at time zone 'Europe/Prague')::date;
  previous date;
begin
  select last_lesson_day into previous from public.stats where user_id = new.user_id;

  insert into public.stats (user_id, xp_total, lessons, streak_days, last_lesson_day, updated_at)
  values (new.user_id, gained, 1, 1, day, now())
  on conflict (user_id) do update set
    xp_total = public.stats.xp_total + gained,
    lessons = public.stats.lessons + 1,
    streak_days = case
      when previous = day then public.stats.streak_days
      when previous = day - 1 then public.stats.streak_days + 1
      else 1
    end,
    last_lesson_day = greatest(coalesce(previous, day), day),
    updated_at = now();

  insert into public.weekly_xp (user_id, week_start, xp)
  values (new.user_id, public.week_start(day), gained)
  on conflict (user_id, week_start) do update set
    xp = public.weekly_xp.xp + gained;

  -- Zařazení do ligy až po zápisu skóre: funkce si čte stats.
  perform public.ensure_league_membership(new.user_id, public.week_start(day));

  return new;
end;
$$;

revoke execute on function public.apply_lesson_event() from public, anon, authenticated;
