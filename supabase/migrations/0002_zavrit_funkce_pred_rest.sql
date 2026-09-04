-- Funkce v public schématu Supabase automaticky vystavuje jako REST endpoint
-- /rest/v1/rpc/<jméno>. U apply_lesson_event() je to nežádoucí: běží jako
-- security definer, tedy s právy vlastníka, a nemá být volatelná odjinud
-- než ze spouštěče. Volání bez kontextu spouštěče by sice skončilo chybou,
-- ale vystavovat ji není důvod.
--
-- Spouštěč funguje dál — ten se nespouští právem volajícího.
revoke execute on function public.apply_lesson_event() from public, anon, authenticated;

-- lesson_xp() je čistá funkce bez vedlejších účinků, takže by neuškodila.
-- Klient ji ale nepotřebuje: XP počítá server při zápisu lekce a offline
-- si je klient spočítá sám v src/core/scoring.ts.
revoke execute on function public.lesson_xp(jsonb) from public, anon, authenticated;
