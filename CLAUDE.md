# Miligram — poznámky pro práci na projektu

PWA pro trénink výpočtů dávkování léků (ČR/SK). Next.js App Router, statický
export, offline-first. Podrobnosti k příkazům a struktuře jsou v README.md.

## Pravidla, která platí bez výjimky

- **Žádný text natvrdo v komponentách.** Všechno přes `next-intl`
  (`messages/cs.json`, `messages/sk.json`) — včetně zadání příkladů
  a krokových řešení.
- **Faktické údaje o lécích se nevymýšlí.** Síly, koncentrace, balení
  a dávkovací rozmezí musí mít v kódu pole `source` a `verifiedAt`
  a pocházet ze SÚKL/ŠÚKL/SPC/AISLP/BNF. Nedohledané šablony se značí
  `needsReview: true` a do produkčního setu nepatří.
- **Červená (`--color-danger`) jen pro chybnou odpověď.** Nikdy dekorativně.
- **Tabulární číslice** všude, kde se hodnota mění (`.num`, `data-numeric`).
- **Sahatelné cíle ≥ 44 px**, primární akce ve spodní třetině obrazovky.
- Generovaný `src/lib/splashScreens.ts` se needituje ručně.
- Údaje se ověřují nástroji v `scripts/sukl/` — ne z paměti. Postup je
  v `scripts/sukl/README.md`, výsledky v `docs/zdroje.md`.

## Ekonomika: dvě veličiny, ne jedna

- **Prášky** — měna. Utrácejí se za nápovědy, ochranu série a opravy.
- **XP** — skóre. Nedá se utratit, slouží k řazení týdenní ligy
  a žebříčku přátel (celkové i týdenní XP).

Důvod pro rozdělení: kdyby se liga řadila podle prášků, každá vzatá
nápověda by uživatele srazila v žebříčku a lidé by se vysvětlením
vyhýbali. XP drží záznam odvedené práce nezávisle na útratě.

Zisk XP: **10 za správný příklad, +20 za bezchybnou lekci.**
Zisk prášků a útrata podle briefu (sekce 6).

## Kde jsme

Aktuální stav a co dělat dál je v `docs/stav.md`.

## Fáze

1. ✅ Základ — PWA, manifest, service worker, iOS onboarding, tokeny, i18n
2. Výpočetní jádro — hotové `src/core` (jednotky, vzorce, tolerance,
   generátor, 59 testů); šablony čekají na schválení seznamu
3. Design systém — klávesnice, obrazovka příkladu, moment vyhodnocení
4. Gamifikace lokálně — Dexie, prášky, série, XP, nápovědy, odbytek
5. Účet a sociální vrstva — Supabase, sync, přátelé, ligy, souboje
6. Lokalizace — dokončení SK
7. Statistiky a tréninkové režimy
8. Leštění — přístupnost, výkon, Lighthouse, test na iPhonu
