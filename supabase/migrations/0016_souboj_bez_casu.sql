-- Souboj bez času.
--
-- Čas rozhodoval při shodě bodů, ale odměňoval spěch. U dávkování jde
-- o správnost, ne o rychlost, a navíc se dal ošidit: přečíst si příklad,
-- odejít a spočítat ho bokem. Při shodě bodů teď rozhodují chyby: kdo
-- chyboval v lehčím příkladu, prohrává. Nepozornost v rutinním výpočtu
-- je u lůžka nebezpečnější než zaváhání ve složitém.
--
-- Obtížnost příkladu je dána jeho pořadím v souboji (DIFFICULTY_RAMP
-- v src/core/lessonPlan.ts), takže stačí značky po příkladech z migrace
-- 0011. Nápověda se počítá jako chyba: soupeř ji vidí jen jako „bez bodu“
-- a jiné pravidlo by prozradilo, co z toho byla chyba.

drop function public.duel_outcome(integer, integer, integer, integer);

/**
 * Obtížnosti příkladů bez bodu, od nejlehčí. Při shodě obtížnosti
 * rozhoduje pořadí, na výsledném poli to ale nic nemění.
 */
create function public.duel_miss_ramp(items jsonb)
  returns integer[]
  language sql
  immutable
  set search_path = ''
as $$
  select coalesce(array_agg(level order by level, ord), '{}')
  from (
    select (array[1, 1, 2, 2, 2, 3, 3])[((i.ord - 1) % 7) + 1] as level, i.ord
    from jsonb_array_elements_text(items) with ordinality as i(mark, ord)
    where i.mark <> 'ok'
  ) misses;
$$;

/**
 * Kdo vyhrál: 1 první, -1 druhý, 0 remíza.
 *
 * POZOR: pravidlo musí souhlasit s duelOutcome v src/core/duel.ts. Body
 * rozhodují. Při shodě se porovnají chyby od nejlehčí a prohraje ten,
 * jehož chyba byla v lehčím příkladu. Výsledek bez značek (starší verze
 * aplikace) při shodě bodů končí remízou.
 */
create function public.duel_outcome(a_points integer, a_items jsonb, b_points integer, b_items jsonb)
  returns integer
  language sql
  immutable
  set search_path = ''
as $$
  select case
    when a_points > b_points then 1
    when a_points < b_points then -1
    when a_items is null or b_items is null then 0
    when public.duel_miss_ramp(a_items) > public.duel_miss_ramp(b_items) then 1
    when public.duel_miss_ramp(a_items) < public.duel_miss_ramp(b_items) then -1
    else 0
  end;
$$;

/**
 * Zapsaný výsledek: poznamenat, kdo odehrál, a když už oba, rozhodnout.
 *
 * Stejné jako v migraci 0010, jen rozhoduje nové pravidlo.
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
    coalesce(new.points, new.correct), new.items,
    coalesce(theirs.points, theirs.correct), theirs.items
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

alter table public.duel_results
  drop constraint duel_results_duration,
  drop column duration_ms;

-- Dohrané souboje podle nového pravidla. Kontumace se nepřepočítávají,
-- tam rozhodlo, kdo nedohrál. Pastilky už připsané zůstávají.
update public.duels d
set winner = case
    when public.duel_outcome(coalesce(a.points, a.correct), a.items, coalesce(b.points, b.correct), b.items) = 1 then a.user_id
    when public.duel_outcome(coalesce(a.points, a.correct), a.items, coalesce(b.points, b.correct), b.items) = -1 then b.user_id
  end
from public.duel_results a, public.duel_results b
where d.status = 'finished'
  and not d.forfeit
  and a.duel_id = d.id and a.user_id = d.challenger
  and b.duel_id = d.id and b.user_id = d.opponent;
