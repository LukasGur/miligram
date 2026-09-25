-- Opakování chyb bez bonusu za lekci bez chyby.
--
-- Opakování chyb ze statistik je často jediný příklad. S bonusem 20 XP
-- za lekci bez chyby vynesl jeden příklad 30 XP — třetinu celé lekce.
-- Klient proto posílá druh lekce a server opakování počítá jen 10 XP
-- za správný příklad. Série a počet lekcí se nemění.
--
-- Starší verze aplikace sloupec neposílají; výchozí 'lesson' je počítá
-- jako dosud. Dřívější opakování zůstávají, jak se započítala — nejsou
-- označená, takže se od lekcí rozeznat nedají.

alter table public.lesson_events
  add column kind text not null default 'lesson'
  constraint lesson_events_kind check (kind in ('lesson', 'review'));

-- POZOR: pravidlo musí souhlasit s src/core/scoring.ts.
create function public.lesson_xp(answers jsonb, kind text)
  returns integer
  language sql
  immutable
  set search_path = ''
as $$
  select coalesce(
    count(*) filter (where (item->>'correct')::boolean) * 10
      + case
          when kind = 'lesson'
            and count(*) > 0
            and count(*) = count(*) filter (where (item->>'correct')::boolean)
          then 20
          else 0
        end,
    0)::integer
  from jsonb_array_elements(answers) as item;
$$;

revoke execute on function public.lesson_xp(jsonb, text) from public, anon, authenticated;

-- Spouštěč beze změny, jen volá lesson_xp i s druhem lekce.
create or replace function public.apply_lesson_event()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  gained integer := public.lesson_xp(new.answers, new.kind);
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

drop function public.lesson_xp(jsonb);
