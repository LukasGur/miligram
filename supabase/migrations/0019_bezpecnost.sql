-- Bezpečnostní opravy podle kontroly z 6. 10. 2026.
--
-- 1. Přátelství. Žádost šla vložit rovnou jako přijatá a adresát mohl při
--    přijetí přepsat, od koho žádost je. Obojí obešlo souhlas druhé
--    strany, a s ním i podmínku „jen kamarád“ u soubojů a darů.
-- 2. Odběry notifikací. Jako adresa zařízení prošla jakákoli https
--    adresa a Edge Function `push` na ni posílala požadavky ze serveru.
--    Teď jen adresy známých push služeb, nejvýš deset zařízení na účet.
-- 3. Minutová úloha. Jeden špatný řádek (nekonečné datum poslední lekce)
--    shodil celou dávku, a s ní připomínky všem a lhůty soubojů.
-- 4. Výsledek souboje. Server bral body z telefonu, jak přišly, takže šlo
--    zapsat 50 : 7. Teď musí sedět sedm značek a body s počtem „ok“.
--    Odpovědi server nevidí, takže čistých 7 bodů ohlídat neumí; to by
--    chtělo hodnocení na serveru (docs/stav.md).

-- ---------------------------------------------------------------------------
-- 1. Přátelství
-- ---------------------------------------------------------------------------

-- Žádost vzniká jen jako čekající. Přijmout ji smí adresát (migrace 0001).
drop policy "žádost posílá jen ten, kdo ji podepíše" on public.friendships;
create policy "žádost posílá jen ten, kdo ji podepíše"
  on public.friendships for insert
  to authenticated
  with check (
    requester = (select auth.uid())
    and status = 'pending'
    and responded_at is null
  );

-- Při přijetí se mění jen stav a čas odpovědi. Politika pro update hlídá
-- adresáta a stav, ne ostatní sloupce; bez tohohle by adresát mohl za
-- žadatele dosadit kohokoli a vyrobit přátelství, o které nikdo nežádal.
create function public.friendships_only_respond()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.requester is distinct from old.requester
    or new.addressee is distinct from old.addressee
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Na žádosti o přátelství se dá změnit jen odpověď.';
  end if;
  return new;
end;
$$;

create trigger friendships_only_respond
  before update on public.friendships
  for each row execute function public.friendships_only_respond();

revoke execute on function public.friendships_only_respond() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Odběry notifikací
-- ---------------------------------------------------------------------------

/**
 * Adresa zařízení od známé push služby: FCM (Chrome, Android, Samsung,
 * Opera), Apple (Safari, iPhone), Mozilla (Firefox) a Microsoft (Edge na
 * Windows). Za jménem služby musí hned následovat lomítko, takže neprojde
 * ani port, ani `fcm.googleapis.com@jinam`.
 *
 * POZOR: stejný vzor stojí v supabase/functions/push/endpoint.ts. Test
 * hlídá, že se nerozešly.
 */
create function public.is_push_endpoint(endpoint text)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)/';
$$;

-- Odběry, které na žádnou push službu nevedou, se smažou. Skutečné
-- zařízení takové nemá; když by přece, zapíše se znovu při dalším
-- otevření aplikace a server ho odmítne.
delete from public.push_subscriptions where not public.is_push_endpoint(endpoint);

alter table public.push_subscriptions
  add constraint push_subscriptions_service check (public.is_push_endpoint(endpoint));

/**
 * Zapíše odběr zařízení na přihlášeného uživatele (migrace 0008). Nově
 * jen od známé push služby a nejvýš deset zařízení na účet: jedenácté
 * vytlačí to, které se zapsalo nejdřív.
 */
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Odběr zapíše jen přihlášený uživatel.';
  end if;
  if not public.is_push_endpoint(p_endpoint) then
    raise exception 'Adresa zařízení nepatří žádné známé push službě.';
  end if;

  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, me, p_p256dh, p_auth)
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    created_at = now(),
    last_ok_at = null;

  delete from public.push_subscriptions s
  where s.user_id = me
    and s.endpoint not in (
      select k.endpoint from public.push_subscriptions k
      where k.user_id = me
      order by k.created_at desc
      limit 10
    );
end;
$$;

revoke execute on function public.register_push_subscription(text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Minutová úloha
-- ---------------------------------------------------------------------------

-- Den poslední lekce posílá telefon. Nekonečné datum by v reminder_context
-- (migrace 0018) při odečtení dnů shodilo dotaz.
update public.notification_prefs set last_lesson_day = null where not isfinite(last_lesson_day);

alter table public.notification_prefs
  add constraint notification_prefs_last_lesson_day check (last_lesson_day is null or isfinite(last_lesson_day));

/**
 * Minutová úloha. Pořadí zůstává jako v migraci 0010 (lhůty soubojů, pak
 * připomínky, pak rozeslání), ale každý krok má vlastní záchrannou síť:
 * kdyby jeden spadl, zbylé proběhnou a chyba skončí v logu.
 */
create function public.push_minute()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  begin
    perform public.resolve_duels();
  exception when others then
    raise warning 'resolve_duels: %', sqlerrm;
  end;

  begin
    perform public.enqueue_reminders();
  exception when others then
    raise warning 'enqueue_reminders: %', sqlerrm;
  end;

  begin
    perform public.dispatch_push();
  exception when others then
    raise warning 'dispatch_push: %', sqlerrm;
  end;
end;
$$;

revoke execute on function public.push_minute() from public, anon, authenticated;

select cron.unschedule('push-minute');
select cron.schedule('push-minute', '* * * * *', $$
  select public.push_minute();
$$);

-- ---------------------------------------------------------------------------
-- 4. Výsledek souboje
-- ---------------------------------------------------------------------------

/**
 * Výsledek souboje musí odpovídat lekci souboje: sedm příkladů
 * (LESSON_LENGTH v src/core/lessonPlan.ts), u každého značka ok, miss
 * nebo hint (DuelMark v src/core/duel.ts) a bod za každé „ok“ (duelScore).
 * Výsledek bez značek už se nepřijme; posílají je všechny verze od
 * migrace 0011.
 */
create function public.duel_results_check()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  valid boolean;
begin
  -- Postupně, ne v jednom „or“: SQL nezaručuje pořadí vyhodnocení a délka
  -- pole by spadla na hodnotě, která pole není.
  valid := new.count = 7 and new.items is not null and jsonb_typeof(new.items) = 'array';
  if valid then
    valid := jsonb_array_length(new.items) = new.count;
  end if;
  if valid then
    valid := not exists (
      select 1 from jsonb_array_elements(new.items) as i(mark)
      where jsonb_typeof(i.mark) <> 'string' or i.mark #>> '{}' not in ('ok', 'miss', 'hint')
    );
  end if;
  if valid then
    valid := new.points is not distinct from (
      select count(*)::integer from jsonb_array_elements_text(new.items) as i(mark) where i.mark = 'ok'
    );
  end if;

  if not valid then
    raise exception 'Výsledek neodpovídá lekci souboje.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger duel_results_check
  before insert on public.duel_results
  for each row execute function public.duel_results_check();

revoke execute on function public.duel_results_check() from public, anon, authenticated;
