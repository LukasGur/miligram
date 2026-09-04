-- Miligram — základ serverové vrstvy.
--
-- Zdrojem pravdy pro hraní zůstává zařízení. Server je replika a sociální
-- vrstva: bez něj aplikace funguje dál, jen se nedá porovnávat s ostatními.
--
-- Dvě zásady, ze kterých plyne zbytek:
--
--  1. Posílají se události, ne stav. Klient nikdy netvrdí „mám 340 XP“ —
--     pošle, že dokončil lekci, a XP si server spočítá sám. Dvě zařízení
--     offline by se stavem přepsala, událostmi ne.
--  2. Autorizaci dělá databáze, ne aplikace. Statický export nemá server,
--     kam by se dala schovat kontrola práv, takže ji nese Row Level Security.

-- ---------------------------------------------------------------------------
-- Profil
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  -- Přezdívka slouží k přidání do přátel, proto musí být jedinečná
  -- a psatelná na telefonu bez diakritiky.
  handle text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,20}$')
);

create unique index profiles_handle_key on public.profiles (lower(handle));

alter table public.profiles enable row level security;

-- Přezdívku ostatních je potřeba vidět kvůli žebříčku a hledání přátel.
create policy "profil je viditelný přihlášeným"
  on public.profiles for select
  to authenticated
  using (true);

create policy "vlastní profil smí založit jen jeho majitel"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "měnit smí uživatel jen svůj profil"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Dokončené lekce
-- ---------------------------------------------------------------------------

-- Záznam nese jen to, co se stalo: která šablona, jaké semínko a jestli
-- uživatel odpověděl správně. Zadání se neukládá — příklad je určený
-- trojicí (šablona, semínko, obtížnost) a dá se z ní sestavit znovu.
create table public.lesson_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- Identifikátor z fronty na zařízení. Opakované odeslání téže události
  -- neprojde, takže výpadek sítě uprostřed synchronizace nic nezdvojí.
  client_event_id text not null,
  lesson_id text not null,
  answers jsonb not null,
  finished_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint lesson_events_client_unique unique (user_id, client_event_id),
  constraint lesson_events_answers_shape
    check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) between 1 and 50)
);

create index lesson_events_user_finished on public.lesson_events (user_id, finished_at desc);

alter table public.lesson_events enable row level security;

create policy "vlastní lekce vidí jen jejich autor"
  on public.lesson_events for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "lekci smí zapsat jen její autor"
  on public.lesson_events for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Události se nepřepisují ani nemažou: žádná politika pro update a delete
-- neexistuje, takže je RLS zamítne.

-- ---------------------------------------------------------------------------
-- Skóre
-- ---------------------------------------------------------------------------

-- POZOR: pravidlo musí souhlasit s src/core/scoring.ts. Je zapsané dvakrát
-- schválně — klient ho potřebuje offline, server mu ho nesmí věřit.
-- 10 XP za správný příklad, 20 navíc za lekci bez chyby.
create function public.lesson_xp(answers jsonb)
  returns integer
  language sql
  immutable
  set search_path = ''
as $$
  select coalesce(
    count(*) filter (where (item->>'correct')::boolean) * 10
      + case
          when count(*) > 0 and count(*) = count(*) filter (where (item->>'correct')::boolean)
          then 20
          else 0
        end,
    0)::integer
  from jsonb_array_elements(answers) as item;
$$;

create table public.stats (
  user_id uuid primary key references auth.users on delete cascade,
  xp_total integer not null default 0,
  lessons integer not null default 0,
  streak_days integer not null default 0,
  last_lesson_day date,
  updated_at timestamptz not null default now()
);

-- Týdenní XP se drží zvlášť, aby se liga nemusela počítat přes celou historii.
-- Týden začíná pondělím, jak je v ČR i SR zvykem.
create table public.weekly_xp (
  user_id uuid not null references auth.users on delete cascade,
  week_start date not null,
  xp integer not null default 0,
  primary key (user_id, week_start)
);

alter table public.stats enable row level security;
alter table public.weekly_xp enable row level security;

-- Skóre je veřejné mezi přihlášenými — bez toho by nešel sestavit žebříček.
-- Zapisovat ho smí jen spouštěč níže, žádná politika pro zápis neexistuje.
create policy "skóre vidí přihlášení"
  on public.stats for select to authenticated using (true);

create policy "týdenní skóre vidí přihlášení"
  on public.weekly_xp for select to authenticated using (true);

/**
 * Přepočet skóre po zapsané lekci.
 *
 * Běží jako security definer, protože zapisuje do tabulek, do kterých
 * uživatel psát nesmí. XP se počítá z odpovědí, ne z čísla poslaného
 * klientem — jinak by stačilo poslat vlastní skóre.
 */
create function public.apply_lesson_event()
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
    -- Táž pravidla jako v src/core/economy.ts: druhá lekce v týž den sérii
    -- nezvyšuje, vynechaný den ji vrací na jedničku.
    streak_days = case
      when previous = day then public.stats.streak_days
      when previous = day - 1 then public.stats.streak_days + 1
      else 1
    end,
    last_lesson_day = greatest(coalesce(previous, day), day),
    updated_at = now();

  insert into public.weekly_xp (user_id, week_start, xp)
  values (new.user_id, date_trunc('week', day)::date, gained)
  on conflict (user_id, week_start) do update set
    xp = public.weekly_xp.xp + gained;

  return new;
end;
$$;

create trigger lesson_event_scores
  after insert on public.lesson_events
  for each row execute function public.apply_lesson_event();

-- ---------------------------------------------------------------------------
-- Přátelé
-- ---------------------------------------------------------------------------

create table public.friendships (
  requester uuid not null references auth.users on delete cascade,
  addressee uuid not null references auth.users on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester, addressee),
  constraint friendships_status check (status in ('pending', 'accepted')),
  constraint friendships_not_self check (requester <> addressee)
);

create index friendships_addressee on public.friendships (addressee, status);

alter table public.friendships enable row level security;

create policy "vazbu vidí obě strany"
  on public.friendships for select
  to authenticated
  using (requester = (select auth.uid()) or addressee = (select auth.uid()));

create policy "žádost posílá jen ten, kdo ji podepíše"
  on public.friendships for insert
  to authenticated
  with check (requester = (select auth.uid()));

-- Přijmout žádost smí jen adresát. Zpět na „pending“ ji převést nejde,
-- takže odmítnutí se řeší smazáním, ne změnou stavu.
create policy "přijmout smí jen adresát"
  on public.friendships for update
  to authenticated
  using (addressee = (select auth.uid()) and status = 'pending')
  with check (addressee = (select auth.uid()) and status = 'accepted');

create policy "zrušit vazbu smí obě strany"
  on public.friendships for delete
  to authenticated
  using (requester = (select auth.uid()) or addressee = (select auth.uid()));
