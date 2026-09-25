-- Notifikace (Web Push).
--
-- Plán je v docs/notifikace.md. Ve zkratce: spouštěče a naplánovaná
-- funkce plní frontu `push_queue`, pg_cron každou minutu zavolá Edge
-- Function `push` (jen když je ve frontě co poslat) a ta rozešle zprávy
-- na zařízení z `push_subscriptions`.
--
-- Rozhodování, komu a kdy, žije tady, ne ve funkci: dá se ověřit dotazem
-- proti živé databázi a funkce zůstane jen tlumočník a pošťák.
--
-- Tajné hodnoty (soukromý klíč VAPID, heslo pro volání funkce a její
-- adresa) jsou ve Vaultu a do migrace nepatří. Zakládají se ručně:
--
--   select vault.create_secret('<json s klíči>', 'push_vapid_keys');
--   select vault.create_secret('<náhodné heslo>', 'push_cron_secret');
--   select vault.create_secret('https://<projekt>.supabase.co/functions/v1/push', 'push_function_url');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Odběry
-- ---------------------------------------------------------------------------

-- Jedno zařízení je jeden řádek; uživatel jich může mít víc. Klíčem je
-- endpoint, protože ten push služba vydává jednou na instalaci — a když
-- se na stejném telefonu přihlásí někdo jiný, odběr přejde na něj.
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  constraint push_subscriptions_endpoint check (endpoint ~ '^https://')
);

create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "vlastní odběry vidí jejich majitel"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Zápis jen přes funkce níže. Přímý upsert by narazil na politiku, když
-- endpoint patřil dřív jinému účtu na témž zařízení.

/**
 * Zapíše odběr zařízení na přihlášeného uživatele. Odběr, který na tomto
 * zařízení patřil jinému účtu, přejde — zařízení patří tomu, kdo je
 * zrovna přihlášený.
 */
create function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Odběr zapíše jen přihlášený uživatel.';
  end if;

  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, (select auth.uid()), p_p256dh, p_auth)
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    created_at = now(),
    last_ok_at = null;
end;
$$;

/**
 * Zruší odběr zařízení. Jen vlastní — cizí endpoint projde bez chyby
 * a bez účinku, ať se z odpovědi nedá poznat, jestli existuje.
 */
create function public.unregister_push_subscription(p_endpoint text)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

revoke execute on function public.register_push_subscription(text, text, text) from public, anon;
revoke execute on function public.unregister_push_subscription(text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text) to authenticated;
grant execute on function public.unregister_push_subscription(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Nastavení
-- ---------------------------------------------------------------------------

create function public.is_time_zone(name text)
  returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names t where t.name = is_time_zone.name);
$$;

-- Nastavení je jedno na účet, ne na zařízení: kdo si posune připomínku
-- na telefonu, nečeká, že mu tablet bude zvonit v původní čas.
create table public.notification_prefs (
  user_id uuid primary key references auth.users on delete cascade,
  locale text not null default 'cs',
  time_zone text not null default 'Europe/Prague',
  reminder_time time not null default '19:00',
  streak boolean not null default true,
  last_chance boolean not null default true,
  social boolean not null default true,
  league boolean not null default true,
  -- Série, jak ji vidí telefon. Server má vlastní v `stats`, ale ta nezná
  -- ochrany série (žijí v telefonu) a v textu musí stát totéž číslo,
  -- které student vidí doma. O tom, jestli připomínat, rozhoduje i tak
  -- lekce zapsaná na serveru.
  streak_days integer not null default 0,
  streak_freezes integer not null default 0,
  last_lesson_day date,
  updated_at timestamptz not null default now(),
  constraint notification_prefs_locale check (locale in ('cs', 'sk')),
  constraint notification_prefs_time_zone check (public.is_time_zone(time_zone)),
  -- Pozdější připomínka by se srazila s poslední šancí ve 21:30 a nocí.
  constraint notification_prefs_reminder_time check (reminder_time between '06:00' and '21:00'),
  constraint notification_prefs_streak check (streak_days between 0 and 100000 and streak_freezes between 0 and 10)
);

alter table public.notification_prefs enable row level security;

create policy "vlastní nastavení vidí jeho majitel"
  on public.notification_prefs for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "vlastní nastavení založí jeho majitel"
  on public.notification_prefs for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "vlastní nastavení mění jeho majitel"
  on public.notification_prefs for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Fronta
-- ---------------------------------------------------------------------------

-- Fronta je zároveň záznam o odeslaném: strop za den a „jednou denně“
-- se počítají z ní. Staré řádky maže cron po třiceti dnech.
create table public.push_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  params jsonb not null default '{}',
  -- Zprávy se stejnou značkou se v telefonu nahradí a ve frontě slijí:
  -- novější neodeslaná přepíše starší.
  tag text not null,
  -- Místní den příjemce u připomínek. Jedinečnost (uživatel, druh, den)
  -- drží „jednou denně“ i při souběhu dvou běhů cronu.
  day date,
  not_before timestamptz not null default now(),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  outcome text,
  attempts integer not null default 0,
  constraint push_queue_kind check (kind in (
    'streak', 'lastChance',
    'duelChallenge', 'duelPlayed', 'duelFinished',
    'friendRequest', 'friendAccepted', 'gift',
    'leagueLastDay', 'leagueResult'
  )),
  constraint push_queue_outcome check (outcome in ('sent', 'noDevice', 'disabled', 'capped', 'failed'))
);

create unique index push_queue_daily on public.push_queue (user_id, kind, day) where day is not null;
create index push_queue_due on public.push_queue (not_before) where sent_at is null;
create index push_queue_user_sent on public.push_queue (user_id, sent_at desc);

-- Bez politik: frontu čte a píše jen služba a spouštěče.
alter table public.push_queue enable row level security;

/**
 * Zařadí zprávu. Neodeslaná zpráva se stejnou značkou se přepíše, takže
 * tři výzvy od téhož kamaráda za minutu dorazí jako jedna.
 */
create function public.enqueue_push(
  p_user uuid,
  p_kind text,
  p_params jsonb,
  p_tag text,
  p_delay interval default '0'
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- Kdo nemá zařízení, nic nedostane; frontu tím zbytečně neplníme.
  if not exists (select 1 from public.push_subscriptions s where s.user_id = p_user) then
    return;
  end if;

  update public.push_queue
  set kind = p_kind, params = p_params, not_before = now() + p_delay, created_at = now()
  where user_id = p_user and tag = p_tag and sent_at is null and claimed_at is null;

  if not found then
    insert into public.push_queue (user_id, kind, params, tag, not_before)
    values (p_user, p_kind, p_params, p_tag, now() + p_delay);
  end if;
end;
$$;

create function public.handle_of(p_user uuid)
  returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select handle from public.profiles where id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- Spouštěče sociální vrstvy
-- ---------------------------------------------------------------------------

/**
 * Výzva na souboj. Odkládá se o čtvrt hodiny: vyzyvatel obvykle hned hraje
 * a jeho výsledek výzvu ve frontě nahradí zprávou „má odehráno, tvůj tah“.
 * Soupeř tak dostane jednu zprávu, ne dvě.
 */
create function public.push_on_duel()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform public.enqueue_push(
    new.opponent,
    'duelChallenge',
    jsonb_build_object('handle', public.handle_of(new.challenger)),
    'duel:' || new.id,
    interval '15 minutes'
  );
  return new;
end;
$$;

create trigger push_on_duel
  after insert on public.duels
  for each row execute function public.push_on_duel();

/**
 * Výsledek souboje. Druhá strana se dozví buď „má odehráno, tvůj tah“,
 * nebo — když už hrála — jak souboj dopadl.
 */
create function public.push_on_duel_result()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  duel public.duels;
  other uuid;
  theirs public.duel_results;
begin
  select * into duel from public.duels where id = new.duel_id;
  other := case when duel.challenger = new.user_id then duel.opponent else duel.challenger end;
  select * into theirs from public.duel_results where duel_id = new.duel_id and user_id = other;

  if theirs.user_id is null then
    perform public.enqueue_push(
      other,
      'duelPlayed',
      jsonb_build_object('handle', public.handle_of(new.user_id), 'correct', new.correct, 'count', new.count),
      'duel:' || new.duel_id
    );
  else
    perform public.enqueue_push(
      other,
      'duelFinished',
      jsonb_build_object(
        'handle', public.handle_of(new.user_id),
        'mine', theirs.correct,
        'theirs', new.correct,
        'outcome', case
          when theirs.correct > new.correct then 'won'
          when theirs.correct < new.correct then 'lost'
          else 'draw'
        end
      ),
      'duel:' || new.duel_id
    );
  end if;
  return new;
end;
$$;

create trigger push_on_duel_result
  after insert on public.duel_results
  for each row execute function public.push_on_duel_result();

create function public.push_on_friendship()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.enqueue_push(
      new.addressee,
      'friendRequest',
      jsonb_build_object('handle', public.handle_of(new.requester)),
      'friend:' || new.requester
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.enqueue_push(
      new.requester,
      'friendAccepted',
      jsonb_build_object('handle', public.handle_of(new.addressee)),
      'friend:' || new.addressee
    );
  end if;
  return new;
end;
$$;

create trigger push_on_friendship
  after insert or update on public.friendships
  for each row execute function public.push_on_friendship();

create function public.push_on_gift()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform public.enqueue_push(
    new.recipient,
    'gift',
    jsonb_build_object('handle', public.handle_of(new.sender)),
    'gift:' || new.id
  );
  return new;
end;
$$;

create trigger push_on_gift
  after insert on public.gifts
  for each row execute function public.push_on_gift();

-- ---------------------------------------------------------------------------
-- Připomínky podle místního času
-- ---------------------------------------------------------------------------

/**
 * Série, jak ji ukazuje telefon dnes. Stejné pravidlo jako currentStreak
 * v src/core/economy.ts: včerejší lekce drží sérii, a ochrana ji podrží
 * i den po vynechání.
 */
create function public.visible_streak(days integer, last_day date, freezes integer, today date)
  returns integer
  language sql
  immutable
  set search_path = ''
as $$
  select case
    when last_day is null then 0
    when last_day >= today - 1 then days
    when freezes > 0 and last_day = today - 2 then days
    else 0
  end;
$$;

/**
 * Pořadí uživatele ve skupině daného týdne: (pořadí, velikost, XP na třetí
 * místo). Stejné řazení jako ensure_league_membership.
 */
create function public.league_standing(p_user uuid, p_season date)
  returns table (rank integer, size integer, xp integer, third_xp integer)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with standings as (
    select m.user_id,
           coalesce(w.xp, 0) as xp,
           rank() over (order by coalesce(w.xp, 0) desc, m.joined_at)::integer as rank,
           count(*) over ()::integer as size
    from public.league_members m
    left join public.weekly_xp w on w.user_id = m.user_id and w.week_start = p_season
    where m.group_id = (
      select m2.group_id from public.league_members m2
      where m2.season = p_season and m2.user_id = p_user
    )
  )
  select s.rank, s.size, s.xp, (select t.xp from standings t where t.rank <= 3 order by t.rank desc limit 1)
  from standings s
  where s.user_id = p_user;
$$;

/**
 * Zařadí připomínky, jejichž čas u příjemce právě nastal.
 *
 * Běží každou minutu. Okno je dvě hodiny, ne minuta: když cron jednou
 * vynechá, připomínka přijde o chvíli později, ne vůbec. „Jednou denně“
 * drží jedinečný index (uživatel, druh, den).
 */
create function public.enqueue_reminders()
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

  -- Liga: neděle večer poslední den, pondělí ráno výsledek. Jen kdo
  -- v tom týdnu v lize byl, tedy dohrál aspoň jednu lekci.
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
    cross join lateral public.league_standing(l.user_id, public.week_start(l.local_day)) st
    where extract(isodow from l.local_day) = 7
      and l.local_now::time >= '18:00' and l.local_now::time < '20:00'
  ),
  result as (
    select l.user_id, l.local_day, st.*, s.league_tier, s.league_season
    from local l
    cross join lateral public.league_standing(l.user_id, public.week_start(l.local_day) - 7) st
    join public.stats s on s.user_id = l.user_id
    where extract(isodow from l.local_day) = 1
      and l.local_now::time >= '09:00' and l.local_now::time < '11:00'
  )
  insert into public.push_queue (user_id, kind, params, tag, day)
  select user_id, 'leagueLastDay',
         jsonb_build_object(
           'rank', rank,
           'size', size,
           -- Na postup chybí jen tomu, kdo je pod třetím místem ve skupině,
           -- kde se postupuje (stejný práh jako migrace 0005).
           'gap', case when size > 8 and rank > 3 then greatest(third_xp - xp + 1, 1) else 0 end
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
           -- Divize po přeřazení. Přeřazuje se až první lekcí v novém týdnu;
           -- kdo už v pondělí ráno hrál, má ji v `stats` hotovou.
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

-- ---------------------------------------------------------------------------
-- Výdej fronty pro Edge Function
-- ---------------------------------------------------------------------------

/**
 * Vydá splatné zprávy k odeslání a rovnou je označí jako převzaté, aby je
 * souběžný běh nevzal podruhé. Převzetí starší pěti minut se považuje
 * za spadlé a zpráva se vydá znovu.
 *
 * Zprávy, které se poslat nemají, vyřídí rovnou: vypnutý druh, žádné
 * zařízení, strop. Sociální a ligové čekají přes noc ve frontě.
 */
create function public.claim_push_batch(p_limit integer default 200)
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
  -- Vypnuté druhy a uživatelé bez zařízení.
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
      or (q.kind in ('duelChallenge', 'duelPlayed', 'duelFinished', 'friendRequest', 'friendAccepted', 'gift') and not p.social)
      or (q.kind in ('leagueLastDay', 'leagueResult') and not p.league)
    );

  -- Kdo nastavení nikdy neuložil, má výchozí (vše zapnuto), jen bez zařízení nic.
  update public.push_queue q
  set sent_at = now(), outcome = 'noDevice'
  where q.sent_at is null
    and q.not_before <= now()
    and not exists (select 1 from public.push_subscriptions s where s.user_id = q.user_id);

  -- Strop: mimo sérii nejvýš čtyři zprávy za místní den.
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
      -- Noc: sociální a ligové počkají do osmi ráno místního času.
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

/**
 * Zapíše, jak odeslání dopadlo. `gone` jsou endpointy, které push služba
 * odmítla jako neexistující — odběr se smaže.
 *
 * Zpráva, kterou se nepodařilo doručit na žádné zařízení, se po třetím
 * pokusu vzdá; do té doby ji další běh vydá znovu.
 */
create function public.finish_push_batch(p_sent bigint[], p_failed bigint[], p_gone text[], p_ok text[])
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.push_queue set sent_at = now(), outcome = 'sent' where id = any(p_sent);

  update public.push_queue
  set claimed_at = null,
      sent_at = case when attempts >= 3 then now() end,
      outcome = case when attempts >= 3 then 'failed' end
  where id = any(p_failed);

  delete from public.push_subscriptions where endpoint = any(p_gone);
  update public.push_subscriptions set last_ok_at = now() where endpoint = any(p_ok);
end;
$$;

/**
 * Tajné hodnoty pro Edge Function. Spustit smí jen služba.
 */
create function public.push_secrets()
  returns table (vapid_keys text, cron_secret text)
  language sql
  security definer
  set search_path = ''
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_keys'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret');
$$;

/**
 * Zavolá Edge Function, když je ve frontě co poslat. Prázdná fronta
 * nestojí nic — žádné volání, žádná spotřeba limitu funkcí.
 */
create function public.dispatch_push()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  url text;
  secret text;
begin
  if not exists (
    select 1 from public.push_queue q
    where q.sent_at is null
      and q.not_before <= now()
      and (q.claimed_at is null or q.claimed_at < now() - interval '5 minutes')
  ) then
    return;
  end if;

  select decrypted_secret into url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_cron_secret';
  if url is null or secret is null then
    return;
  end if;

  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Push-Secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

-- Nic z toho nesmí volat klient.
revoke execute on function public.is_time_zone(text) from public, anon, authenticated;
revoke execute on function public.enqueue_push(uuid, text, jsonb, text, interval) from public, anon, authenticated;
revoke execute on function public.handle_of(uuid) from public, anon, authenticated;
revoke execute on function public.push_on_duel() from public, anon, authenticated;
revoke execute on function public.push_on_duel_result() from public, anon, authenticated;
revoke execute on function public.push_on_friendship() from public, anon, authenticated;
revoke execute on function public.push_on_gift() from public, anon, authenticated;
revoke execute on function public.visible_streak(integer, date, integer, date) from public, anon, authenticated;
revoke execute on function public.league_standing(uuid, date) from public, anon, authenticated;
revoke execute on function public.enqueue_reminders() from public, anon, authenticated;
revoke execute on function public.claim_push_batch(integer) from public, anon, authenticated;
revoke execute on function public.finish_push_batch(bigint[], bigint[], text[], text[]) from public, anon, authenticated;
revoke execute on function public.push_secrets() from public, anon, authenticated;
revoke execute on function public.dispatch_push() from public, anon, authenticated;

grant execute on function public.claim_push_batch(integer) to service_role;
grant execute on function public.finish_push_batch(bigint[], bigint[], text[], text[]) to service_role;
grant execute on function public.push_secrets() to service_role;

-- Kontrola časového pásma běží jménem toho, kdo nastavení ukládá.
grant execute on function public.is_time_zone(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Plán
-- ---------------------------------------------------------------------------

select cron.schedule('push-minute', '* * * * *', $$
  select public.enqueue_reminders();
  select public.dispatch_push();
$$);

select cron.schedule('push-cleanup', '17 3 * * *', $$
  delete from public.push_queue where created_at < now() - interval '30 days';
$$);
