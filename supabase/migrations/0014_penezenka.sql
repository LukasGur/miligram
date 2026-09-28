-- Peněženka na serveru.
--
-- Pastilky a ochrany série žily jen v telefonu. Na novém telefonu tak
-- student začínal od nuly a série obnovená z historie nevěděla o použitých
-- ochranách, takže vyšla kratší. Teď telefon posílá pohyby — kolik přibylo,
-- kolik ubylo, kdy ochrana pokryla den — a zůstatek je jejich součet.
--
-- Model důvěry je jiný než u XP. XP je veřejné a řadí ligu, proto ho server
-- počítá sám z odpovědí. Pastilky jsou soukromá měna: nikdo jiný je nevidí
-- a nic podle nich neřadí. Kdo by si je vymyslel, podvede jen sebe. Proto
-- server pohyby přijímá od klienta a hlídá jen rozumné meze, ne pravidla
-- ekonomiky — ta žijí v src/core/economy.ts a server by je musel
-- zdvojovat, aniž by tím někoho chránil.

create table public.wallet_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- Identita pohybu z telefonu. Kde to jde, je odvozená z toho, co pohyb
  -- způsobilo (odpověď, dar, souboj), takže ho ani dvě zařízení nezapíšou
  -- dvakrát.
  client_event_id text not null,
  kind text not null,
  pills integer not null default 0,
  freezes integer not null default 0,
  -- Proč: nápověda, ochrana, dar… Jen pro čtení člověkem.
  reason text not null default '',
  -- Den, který pohyb pokryl (ochrana série). Místní kalendář uživatele.
  day date,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint wallet_events_client_unique unique (user_id, client_event_id),
  constraint wallet_events_kind check (kind in ('earn', 'spend', 'freezeGained', 'freezeUsed', 'opening', 'signup')),
  -- Meze, ne pravidla. Nejdražší útrata je dnes ochrana (60), nejvyšší
  -- příjem výhra v souboji (15); rezerva je pro změny cen bez migrace.
  constraint wallet_events_bounds check (
    case kind
      when 'earn' then pills between 0 and 100 and freezes = 0
      when 'spend' then pills between -1000 and -1 and freezes between 0 and 1
      when 'freezeGained' then pills = 0 and freezes = 1
      when 'freezeUsed' then pills = 0 and freezes = -1 and day is not null
      when 'opening' then pills between 0 and 100000 and freezes between 0 and 5
      when 'signup' then pills between 0 and 1000 and freezes = 0
    end
  ),
  constraint wallet_events_reason_length check (char_length(reason) <= 80)
);

create index wallet_events_user on public.wallet_events (user_id);
create index wallet_events_user_days on public.wallet_events (user_id, day) where day is not null;
-- Bonus za registraci jednou na účet.
create unique index wallet_events_one_signup on public.wallet_events (user_id) where kind = 'signup';

alter table public.wallet_events enable row level security;

create policy "vlastní peněženku vidí jen její majitel"
  on public.wallet_events for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Bonus za registraci si klient zapsat nesmí; připisuje ho funkce níže.
create policy "pohyb smí zapsat jen jeho majitel"
  on public.wallet_events for insert
  to authenticated
  with check (user_id = (select auth.uid()) and kind <> 'signup');

-- Pohyby se nepřepisují ani nemažou: politika pro update a delete chybí.

/**
 * Zůstatek a dny pokryté ochranou.
 *
 * Dny se vracejí kvůli obnově na novém telefonu: série se z historie skládá
 * týmž pravidlem jako při hraní, a to potřebuje vědět, který vynechaný den
 * podržela ochrana.
 */
create function public.my_wallet()
  returns table (pills integer, freezes integer, covered_days date[])
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select
    coalesce(sum(w.pills), 0)::integer,
    coalesce(sum(w.freezes), 0)::integer,
    coalesce(array_agg(distinct w.day order by w.day) filter (where w.day is not null), '{}')
  from public.wallet_events w
  where w.user_id = (select auth.uid());
$$;

revoke execute on function public.my_wallet() from public, anon;
grant execute on function public.my_wallet() to authenticated;

/**
 * Bonus za registraci. Jednou na účet — hlídá to jedinečný index, ne
 * klient. Vrací, jestli se připsal teď; podruhé je to false a nic se nestane.
 *
 * Výše je tady a v src/core/economy.ts (SIGNUP_BONUS); test hlídá shodu.
 */
create function public.claim_signup_bonus()
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  me uuid := auth.uid();
  inserted integer;
begin
  if me is null then
    return false;
  end if;
  insert into public.wallet_events (user_id, client_event_id, kind, pills, reason)
  values (me, 'signup', 'signup', 30, 'signup')
  on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;

revoke execute on function public.claim_signup_bonus() from public, anon;
grant execute on function public.claim_signup_bonus() to authenticated;

-- ---------------------------------------------------------------------------
-- Série z historie
-- ---------------------------------------------------------------------------

/**
 * Série přepočítaná z celé historie.
 *
 * Dřív ji spouštěč posouval o krok podle předchozí lekce a o ochranách
 * nevěděl — kdo den podržel ochranou, měl na serveru (a tedy u kamarádů)
 * sérii od jedničky. Teď se skládá z dní s lekcí a dní pokrytých ochranou:
 * pokrytý den řadu nepřeruší, ale nepřičte se, stejně jako v telefonu
 * (advanceStreak v src/core/economy.ts).
 *
 * Počítá se celá, ne přírůstkem, takže nezáleží na pořadí, v jakém pohyby
 * a lekce dorazí.
 */
create function public.recompute_streak(p_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  last_day date;
  streak integer;
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
     where w.user_id = p_user and w.kind = 'freezeUsed' and w.day is not null
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
  select count(*) filter (where played)::integer
    into streak
    from islands
   where island = (select island from islands where day = last_day);

  update public.stats
     set streak_days = coalesce(streak, 1),
         last_lesson_day = last_day,
         updated_at = now()
   where user_id = p_user;
end;
$$;

revoke execute on function public.recompute_streak(uuid) from public, anon, authenticated;

-- Spouštěč lekce: XP a liga beze změny, série z historie.
create or replace function public.apply_lesson_event()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  gained integer := public.lesson_xp(new.answers, new.kind);
  day date := (new.finished_at at time zone 'Europe/Prague')::date;
begin
  insert into public.stats (user_id, xp_total, lessons, streak_days, last_lesson_day, updated_at)
  values (new.user_id, gained, 1, 1, day, now())
  on conflict (user_id) do update set
    xp_total = public.stats.xp_total + gained,
    lessons = public.stats.lessons + 1,
    updated_at = now();

  perform public.recompute_streak(new.user_id);

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

-- Ochrana, která dorazí po lekci, sérii na serveru opraví zpětně.
create function public.apply_wallet_event()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.day is not null then
    perform public.recompute_streak(new.user_id);
  end if;
  return new;
end;
$$;

revoke execute on function public.apply_wallet_event() from public, anon, authenticated;

create trigger wallet_event_streak
  after insert on public.wallet_events
  for each row execute function public.apply_wallet_event();
