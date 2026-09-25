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
- **Postupy výpočtu smí pocházet i z doporučeného postupu odborné
  společnosti** (ISPAD, ČDS ČLS JEP a podobně), s plnou citací včetně
  ročníku a stran. Je to jiný druh zdroje než souhrn údajů o přípravku:
  jak se dávka počítá, v SPC nestojí a stát nebude. Kde takový postup
  dává jen odhad pro začátek, musí to být vidět v zadání i v poznámce
  o zdroji — ať student ví, že počítá orientační hodnotu, ne ordinaci.
- **Červená (`--color-danger`) jen pro chybnou odpověď.** Nikdy dekorativně.
- **Tabulární číslice** všude, kde se hodnota mění (`.num`, `data-numeric`).
- **Sahatelné cíle ≥ 44 px**, primární akce ve spodní třetině obrazovky.
- Generovaný `src/lib/splashScreens.ts` se needituje ručně.
- Údaje se ověřují nástroji v `scripts/sukl/` — ne z paměti. Postup je
  v `scripts/sukl/README.md`, výsledky v `docs/zdroje.md`.

## Ekonomika: dvě veličiny, ne jedna

- **Pastilky** — měna. Utrácejí se za nápovědy a ochranu série. V kódu
  a v databázi se pořád jmenují `pills` (dřív „prášky“); přejmenovaly se
  jen texty a ikona, data zůstala.
- **XP** — skóre. Nedá se utratit, slouží k řazení týdenní ligy
  a žebříčku přátel (celkové i týdenní XP).

Důvod pro rozdělení: kdyby se liga řadila podle pastilek, každá vzatá
nápověda by uživatele srazila v žebříčku a lidé by se vysvětlením
vyhýbali. XP drží záznam odvedené práce nezávisle na útratě.

Zisk XP: **10 za příklad správně napoprvé, +20 za lekci bez chyby.**
Chybný příklad se v lekci vrací, dokud ho student nespočítá — lekce je
hotová, až vyjde všech sedm. Opakování se ale do odměny nepočítá: XP
i pastilky jsou za první pokus, jinak by se skóre dalo nasbírat chybováním.

Zisk pastilek: **2 za příklad správně napoprvé, +10 za lekci bez chyby.**
Útrata: nápověda 15, ochrana série 60 (nejvýš dvě naráz).

## Kde jsme

Aktuální stav a co dělat dál je v `docs/stav.md`.

## Fáze

1. ✅ Základ — PWA, manifest, service worker, iOS onboarding, tokeny, i18n
2. Výpočetní jádro — hotové `src/core` (jednotky, vzorce, tolerance,
   generátor, 59 testů); šablony čekají na schválení seznamu
3. Design systém — klávesnice, obrazovka příkladu, moment vyhodnocení
4. Gamifikace lokálně — Dexie, pastilky, série, XP, nápovědy, odbytek
5. Účet a sociální vrstva — Supabase, sync, přátelé, ligy, souboje
6. Lokalizace — dokončení SK
7. Statistiky a tréninkové režimy
8. Leštění — přístupnost, výkon, Lighthouse, test na iPhonu a Androidu

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
