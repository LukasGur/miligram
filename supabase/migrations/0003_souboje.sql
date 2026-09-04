-- Souboje.
--
-- Souboj není kopie lekce, jen její identifikátor. Příklad je určený
-- trojicí (šablona, semínko, obtížnost) a lekce se z jednoho řetězce
-- sestaví znovu na obou zařízeních — takže se nikam neukládá zadání
-- ani odpovědi, jen kdo koho vyzval a jak to dopadlo.

create table public.duels (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null,
  challenger uuid not null references auth.users on delete cascade,
  opponent uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  constraint duels_not_self check (challenger <> opponent)
);

create index duels_opponent on public.duels (opponent, created_at desc);
create index duels_challenger on public.duels (challenger, created_at desc);

-- Výsledek je vlastní řádek pro každou stranu. Kdyby byl jeden řádek
-- se dvěma sloupci, musela by politika hlídat, který z nich kdo mění;
-- takhle stačí, že si každý smí zapsat jen svůj.
create table public.duel_results (
  duel_id uuid not null references public.duels on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  correct integer not null,
  count integer not null,
  finished_at timestamptz not null default now(),
  primary key (duel_id, user_id),
  constraint duel_results_range check (correct between 0 and count and count between 1 and 50)
);

alter table public.duels enable row level security;
alter table public.duel_results enable row level security;

create policy "souboj vidí jen jeho strany"
  on public.duels for select
  to authenticated
  using (challenger = (select auth.uid()) or opponent = (select auth.uid()));

-- Vyzvat jde jen potvrzeného kamaráda. Bez toho by šlo posílat výzvy komukoli,
-- jehož přezdívku někdo uhodne.
create policy "vyzvat smí jen kamarád"
  on public.duels for insert
  to authenticated
  with check (
    challenger = (select auth.uid())
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = challenger and f.addressee = opponent)
          or (f.requester = opponent and f.addressee = challenger))
    )
  );

create policy "souboj smí zrušit ten, kdo ho vypsal"
  on public.duels for delete
  to authenticated
  using (challenger = (select auth.uid()));

create policy "výsledky vidí obě strany souboje"
  on public.duel_results for select
  to authenticated
  using (
    exists (
      select 1 from public.duels d
      where d.id = duel_id
        and ((select auth.uid()) in (d.challenger, d.opponent))
    )
  );

-- Zapsat smí každý jen svůj výsledek, a jen v souboji, kterého se účastní.
-- Přepisovat ho nejde: politika pro update neexistuje, takže druhý pokus
-- narazí na primární klíč.
create policy "vlastní výsledek zapíše jen jeho autor"
  on public.duel_results for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.duels d
      where d.id = duel_id
        and ((select auth.uid()) in (d.challenger, d.opponent))
    )
  );
