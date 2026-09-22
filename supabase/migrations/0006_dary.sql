-- Darování ochrany série kamarádovi.
--
-- Prášky zůstávají v telefonu. Přesunout zůstatek na server by znamenalo
-- buď nákup nápovědy jen online, nebo optimistické strhávání, které se
-- rozejde — a učení by to nepřineslo nic.
--
-- Dar je proto událost, ne převod: telefon odesílatele si prášky strhne
-- sám a na server jde jen „poslal jsem kamarádovi ochranu série“. Proti
-- upravenému klientovi, který by daroval bez zaplacení, nechrání zůstatek,
-- ale nárok odvozený z práce, kterou server už zná: jeden dar za týden
-- a jen od někoho, kdo aspoň jednu lekci opravdu dohrál.

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references auth.users on delete cascade,
  recipient uuid not null references auth.users on delete cascade,
  -- Zatím jediný druh daru. Sloupec tu je, aby další nepotřeboval migraci
  -- tabulky, jen rozšíření podmínky.
  kind text not null default 'streakFreeze',
  -- Týden se zapisuje z databáze, ne z klienta: jinak by si odesílatel
  -- vybral jiný a strop by neplatil.
  week date not null default public.week_start(current_date),
  created_at timestamptz not null default now(),
  -- Vyplní příjemce, až si ochranu připíše do zásob. Do té doby dar čeká;
  -- kdo má zásobu plnou, si ho vyzvedne později.
  claimed_at timestamptz,
  constraint gifts_kind check (kind = 'streakFreeze'),
  constraint gifts_not_self check (sender <> recipient),
  constraint gifts_one_per_week unique (sender, week)
);

create index gifts_recipient on public.gifts (recipient, claimed_at);

alter table public.gifts enable row level security;

create policy "dar vidí obě strany"
  on public.gifts for select
  to authenticated
  using (sender = (select auth.uid()) or recipient = (select auth.uid()));

/**
 * Darovat smí jen potvrzenému kamarádovi, jednou za týden a jen ten, kdo
 * sám něco odehrál. Jedinečnost (sender, week) drží strop; tahle politika
 * drží zbytek. Týden se nedá předat zvenčí — sloupec má výchozí hodnotu
 * z databáze a politika ji vynutí.
 */
create policy "darovat smí kamarád, jednou za týden"
  on public.gifts for insert
  to authenticated
  with check (
    sender = (select auth.uid())
    and week = public.week_start(current_date)
    and claimed_at is null
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = sender and f.addressee = recipient)
          or (f.requester = recipient and f.addressee = sender))
    )
    and exists (
      select 1 from public.lesson_events e where e.user_id = sender
    )
  );

/**
 * Dar si vyzvedne jen jeho příjemce a jen jednou. Politika pouští update
 * pouze na nevyzvednutý dar; co se v něm smí změnit, hlídá spouštěč —
 * politika sama na porovnání starého a nového řádku nedosáhne.
 */
create policy "vyzvednout smí jen příjemce"
  on public.gifts for update
  to authenticated
  using (recipient = (select auth.uid()) and claimed_at is null)
  with check (recipient = (select auth.uid()) and claimed_at is not null);

create function public.gifts_only_claim()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.sender is distinct from old.sender
    or new.recipient is distinct from old.recipient
    or new.kind is distinct from old.kind
    or new.week is distinct from old.week
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Na daru se dá změnit jen vyzvednutí.';
  end if;
  return new;
end;
$$;

create trigger gifts_only_claim
  before update on public.gifts
  for each row execute function public.gifts_only_claim();

revoke execute on function public.gifts_only_claim() from public, anon, authenticated;

-- Ligová migrace zapověděla spouštění všech pomocných funkcí, včetně
-- week_start(). U ní to bylo přehnané: nic nečte, jen posune datum na
-- pondělí — a výchozí hodnota sloupce i politika výše ji potřebují spustit
-- jménem volajícího.
grant execute on function public.week_start(date) to authenticated;
