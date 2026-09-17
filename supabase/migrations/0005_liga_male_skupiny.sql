-- Postup a sestup se uplatní jen ve skupině, která je na ně dost velká.
--
-- Bez toho by ve tříčlenné skupině postoupili všichni: podmínka „pořadí
-- do třetího místa" platí pro každého a větev pro sestup se k slovu
-- nedostane. Práh je stejný jako v rozhraní (src/core/league.ts), kde se
-- ze stejného důvodu nekreslí zóny.
--
-- Celé tělo funkce je v migraci 0004; tady se mění jen podmínka
-- a konstanty se pojmenovaly.
create or replace function public.ensure_league_membership(p_user uuid, p_season date)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  promoted constant integer := 3;
  relegated constant integer := 5;
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

  if standing is not null and group_size > promoted + relegated then
    if standing <= promoted then
      current_tier := least(current_tier + 1, 5);
    elsif standing > group_size - relegated then
      current_tier := greatest(current_tier - 1, 1);
    end if;
  end if;

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
