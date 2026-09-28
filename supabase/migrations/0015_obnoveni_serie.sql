-- Obnovení spadlé série.
--
-- Pastilky jsou soukromé a server u nich hlídá jen meze (migrace 0014).
-- Série ale soukromá není — vidí ji kamarádi. Obnovení proto hlídá server
-- i věcně: jen krátce po ztrátě a nejvýš jednou za třicet dní. Cena a to,
-- jestli série byla dost dlouhá, jsou pravidla aplikace (src/core/economy.ts);
-- ta server nezdvojuje, protože nikoho jiného nechrání.
--
-- Obnovení je pohyb v peněžence s dnem, který pokrývá — stejně jako
-- použitá ochrana. Vynechané dny můžou být dva: první pohyb nese cenu,
-- druhý jen den.

alter table public.wallet_events drop constraint wallet_events_kind;
alter table public.wallet_events add constraint wallet_events_kind
  check (kind in ('earn', 'spend', 'freezeGained', 'freezeUsed', 'opening', 'signup', 'repair'));

alter table public.wallet_events drop constraint wallet_events_bounds;
alter table public.wallet_events add constraint wallet_events_bounds check (
  case kind
    when 'earn' then pills between 0 and 100 and freezes = 0
    when 'spend' then pills between -1000 and -1 and freezes between 0 and 1
    when 'freezeGained' then pills = 0 and freezes = 1
    when 'freezeUsed' then pills = 0 and freezes = -1 and day is not null
    when 'opening' then pills between 0 and 100000 and freezes between 0 and 5
    when 'signup' then pills between 0 and 1000 and freezes = 0
    when 'repair' then pills between -1000 and 0 and freezes = 0 and day is not null
  end
);

/**
 * Věcné meze obnovení.
 *
 * - den musí být nedávný: obnovuje se krátce po ztrátě, ne zpětně
 *   za měsíc (rezerva na časová pásma),
 * - placené obnovení nejvýš jednou za třicet dní,
 * - neplacený druhý den jen spolu s placeným obnovením těsně předtím.
 */
create function public.check_repair()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.kind <> 'repair' then
    return new;
  end if;

  if new.day < current_date - 4 or new.day > current_date + 1 then
    raise exception 'Obnovit jde jen nedávno vynechaný den.' using errcode = 'check_violation';
  end if;

  if new.pills < 0 then
    if exists (
      select 1 from public.wallet_events w
       where w.user_id = new.user_id and w.kind = 'repair' and w.pills < 0
         and w.created_at > now() - interval '29 days'
    ) then
      raise exception 'Sérii jde obnovit nejvýš jednou za třicet dní.' using errcode = 'check_violation';
    end if;
  elsif not exists (
    select 1 from public.wallet_events w
     where w.user_id = new.user_id and w.kind = 'repair' and w.pills < 0
       and w.created_at > now() - interval '1 hour'
       and abs(w.day - new.day) <= 2
  ) then
    raise exception 'Druhý den se obnovuje jen spolu s placeným obnovením.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_repair() from public, anon, authenticated;

create trigger wallet_event_repair_check
  before insert on public.wallet_events
  for each row execute function public.check_repair();

-- ---------------------------------------------------------------------------
-- Kam až série sahá
-- ---------------------------------------------------------------------------

-- Obnovená série sahá přes pokryté dny až ke včerejšku, i když poslední
-- lekce byla předevčírem. Kamarádi sérii dopočítávají z posledního dne
-- (visibleStreak) — bez tohohle sloupce by jim obnovená série do další
-- lekce ukazovala nulu.
alter table public.stats add column streak_through date;

create or replace function public.recompute_streak(p_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  last_day date;
  streak integer;
  through date;
begin
  select max((e.finished_at at time zone 'Europe/Prague')::date)
    into last_day
    from public.lesson_events e
   where e.user_id = p_user;

  if last_day is null then
    return;
  end if;

  with lesson_days as (
    select distinct (e.finished_at at time zone 'Europe/Prague')::date as day
      from public.lesson_events e
     where e.user_id = p_user
  ),
  covered as (
    select distinct w.day
      from public.wallet_events w
     where w.user_id = p_user and w.kind in ('freezeUsed', 'repair') and w.day is not null
  ),
  days as (
    select day, true as played from lesson_days
    union
    select c.day, false from covered c where c.day not in (select day from lesson_days)
  ),
  islands as (
    select day, played, day - (row_number() over (order by day))::integer as island
      from days
  )
  select count(*) filter (where played)::integer, max(day)
    into streak, through
    from islands
   where island = (select island from islands where day = last_day);

  update public.stats
     set streak_days = coalesce(streak, 1),
         last_lesson_day = last_day,
         streak_through = greatest(coalesce(through, last_day), last_day),
         updated_at = now()
   where user_id = p_user;
end;
$$;

revoke execute on function public.recompute_streak(uuid) from public, anon, authenticated;

-- Peněženka vrací i den posledního placeného obnovení: lhůta třiceti dní
-- musí platit napříč zařízeními.
drop function public.my_wallet();

create function public.my_wallet()
  returns table (pills integer, freezes integer, covered_days date[], last_repair date)
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select
    coalesce(sum(w.pills), 0)::integer,
    coalesce(sum(w.freezes), 0)::integer,
    coalesce(array_agg(distinct w.day order by w.day) filter (where w.day is not null), '{}'),
    (max(w.created_at) filter (where w.kind = 'repair' and w.pills < 0))::date
  from public.wallet_events w
  where w.user_id = (select auth.uid());
$$;

revoke execute on function public.my_wallet() from public, anon;
grant execute on function public.my_wallet() to authenticated;

-- Stávající série dostanou svůj konec hned, ne až s další lekcí.
select public.recompute_streak(user_id) from public.stats;
