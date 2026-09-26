/**
 * Soukromí úspěšnosti.
 *
 * Kamarádi vidí snahu — sérii, XP, ligu, odznaky. Úspěšnost napoprvé
 * a chyby patří jen studentovi: v učící se aplikaci je chyba způsob, jak
 * se učit, a kdyby byla vidět, lidi by se jí vyhýbali (a s ní nápovědě
 * i těžším tématům). Výjimka je souboj — tam jdou oba dobrovolně na
 * stejných sedm příkladů.
 *
 * Proto pryč s funkcí, která kamarádovi vydala úspěšnost podle šablon.
 * Místo ní profil nese dosažené stupně odznaků, které si zapíše zařízení
 * samo (počítají se z dat na něm, stejně jako pastilky).
 */

drop function if exists public.friend_template_stats(uuid);

alter table public.profiles
  add column badges jsonb not null default '{}'::jsonb
  constraint profiles_badges_object check (jsonb_typeof(badges) = 'object' and pg_column_size(badges) < 2048);
