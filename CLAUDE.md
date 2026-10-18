# Miligram — poznámky pro práci na projektu

PWA pro trénink výpočtů dávkování léků (ČR/SK). Next.js App Router, statický
export, offline-first. Příkazy jsou v README.md, struktura a architektonická
rozhodnutí v `docs/architektura.md`. Před pushem `pnpm build:pages`
(typecheck, testy, build); push na master je nasazení.

## Pravidla, která platí bez výjimky

- **Žádný text natvrdo v komponentách.** Všechno přes `next-intl`
  (`messages/cs.json`, `messages/sk.json`) — včetně zadání příkladů
  a krokových řešení.
- **Faktické údaje o lécích se nevymýšlí.** Síly, koncentrace, balení
  a dávkovací rozmezí musí mít v kódu pole `source` a `verifiedAt`
  a pocházet ze SÚKL/ŠÚKL/SPC/AISLP/BNF. Nedohledané šablony se značí
  `needsReview: true` a do produkčního setu nepatří.
- **Dávka v zadání i ve výsledku musí být taková, jakou by někdo
  opravdu podal** — v rozmezí, které SPC uvádí pro danou situaci,
  pacienta a lékovou formu. Správné číslo ze zdroje nestačí: „TAXOTERE
  je 2% roztok, pacient dostal 500 ml“ dávalo 10 g docetaxelu, smrtelnou
  dávku. Meze jsou v `docs/zdroje.md`, oddíl 8, a hlídá je test.
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
Opakování chyb ze statistik bonus za lekci bez chyby nedostává (XP ani
pastilky) — bývá to jediný příklad a vyneslo by skoro jako celá lekce.
Do série a počtu lekcí se počítá.
Pastilky za příklad se připisují hned po odpovědi (zůstatek je vidět
v hlavičce lekce), bonus a XP až s dokončenou lekcí.
Útrata: nápověda 15, ochrana série 60 (nejvýš dvě naráz), dar ochrany
kamarádovi 30 (jednou týdně) — darovat se má vyplatit víc než kupovat sobě.
Za založení účtu 30 pastilek, jednou na účet (připisuje server).
Obnovení spadlé série 200, jen u série aspoň 7 dní, do konce druhého dne
po ztrátě a nejvýš jednou za 30 dní (lhůtu a četnost hlídá i server,
migrace 0015 — série je veřejná).

Pastilky a ochrany drží server jako součet pohybů (`wallet_events`,
migrace 0014); telefon posílá, co se stalo, frontou jako lekce. Pastilky
jsou soukromé, takže server hlídá jen meze, ne pravidla — kdo by si je
vymyslel, podvede sebe. XP je veřejné, a proto ho server dál počítá sám.

Data v telefonu patří jednomu účtu (`Profile.ownerId`, `src/lib/account.ts`).
Registrace si je vezme, přihlášení k účtu s historií telefon po potvrzení
vyčistí, odhlášení ho vyčistí vždy. Synchronizace mluví jen za vlastníka.

Souboj: výhra +15 pastilek, remíza +5, remíza bez chyby (7 : 7) +10,
XP žádné navíc (lekce souboje dá běžné XP). Jinak by se liga dala
nafouknout vzájemným vyzýváním. Rozhodují body; při shodě prohrává ten,
kdo chyboval v lehčím příkladu (nápověda se počítá jako chyba). Čas
nerozhoduje: jde o správnost, ne o rychlost. Kdo vyhrál, rozhoduje server
(`duel_outcome`, migrace 0016); pastilky si
připíše zařízení samo, jednou za souboj. Pravidla souboje jsou
v `src/core/duel.ts` a musí souhlasit s migrací — test to hlídá.

## Co vidí kamarádi

Snahu ano, výsledky ne. Veřejné je to, co se dá vypracovat tréninkem:
série, XP, liga, odznaky, souboje. Úspěšnost napoprvé, chyby a nápovědy
vidí jen student — v učící se aplikaci je chyba způsob učení a kdyby byla
vidět, lidi by se vyhýbali nápovědě i těžším tématům. Výjimka je souboj
(oba dobrovolně, stejných sedm příkladů), ale i tam soupeř vidí nápovědu
jen jako „bez bodu“. Server úspěšnost nikomu jinému nevydá (migrace 0012).

## Kde jsme

Aktuální stav a co dělat dál je v `docs/stav.md`.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
