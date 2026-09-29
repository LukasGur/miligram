-- Smazání účtu.
--
-- GDPR dává právo na výmaz a aplikace ho má umět sama, ne přes e-mail.
-- Všechny tabulky odkazují na auth.users s `on delete cascade` (lekce,
-- peněženka, statistiky, liga, přátelé, souboje, dary, notifikace), takže
-- stačí smazat uživatele. U soubojů, které vyhrál, se vítěz nastaví na
-- null; souboj sám zmizí s ním, protože byl jednou ze stran.
--
-- Klient smí smazat jen sám sebe: auth.uid(), žádný parametr.

create function public.delete_my_account()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Smazat jde jen vlastní účet.';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
