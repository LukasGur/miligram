# Kde jsme

Poslední aktualizace: **3. 9. 2026**

## Hotovo

**Fáze 1** — PWA kostra. Statický export, vlastní service worker s precache
manifestem, iOS instalační lišta, designové tokeny, next-intl. Ověřeno
offline v Chromiu i vizuálně ve WebKitu.

**Fáze 2, jádro** — `src/core`: jednotky, vzorce, tolerance odvozená z norem
prostředků, deterministický generátor, fond 614 přípravků ze SÚKL,
tabulky dávkovacích rozmezí, rekonstituce a elektrolytů opsané ze SPC.

**Fáze 2, šablony** — hotovo **72 ze 72** včetně českých a slovenských
textů. Testů prochází 275. Mimo produkční set zůstává jediná, I3,
která čeká na zdroj.

| Kategorie | Hotovo | Zbývá |
|---|---|---|
| A základní dávkování | A1–A8 | — |
| B podle hmotnosti | B1–B8 | — |
| C povrch těla | C1–C5 | — |
| D ředění | D1–D8 | — |
| E rekonstituce | E1–E5 | — |
| F rychlost infuze | F1–F6 | — |
| G vazoaktivní | G1–G7 | — |
| H převody jednotek | H1–H6 | — |
| I inzulin | I1–I4 (I3 `needsReview`) | — |
| J renální dávkování | J1–J5 | — |
| K pediatrie | K1–K6 | — |
| L onkologie | L1–L4 | — |

**Fáze 3, rozhraní** — obrazovka příkladu, vlastní numerická klávesnice,
moment vyhodnocení a krokové řešení sázené KaTeXem. Lekce má sedm příkladů
se stoupající obtížností a je určená jediným identifikátorem, takže se dá
sestavit znovu. Ověřeno ve WebKitu na rozměrech iPhonu, česky i slovensky.

**Fáze 5, účet a sociální vrstva** — projekt Supabase `Miligram`
(`xvlhqtqwftgmirsjqpul`, eu-central-1). Schéma, politiky, přihlášení kódem
z e-mailu, přezdívka, přátelé, žebříček, souboje a odesílání fronty
na pozadí. Ověřeno proti živé databázi přes publikovatelný klíč, tedy
stejnou cestou, jakou k ní sahá aplikace:

- cizí lekce, souboje ani výsledky nejsou vidět
- skóre nejde přepsat, XP připisuje jen spouštěč z odpovědí
- opakované odeslání téže lekce XP nezdvojí
- žádost o přátelství smí přijmout jen adresát
- vyzvat na souboj jde jen potvrzeného kamaráda
- výsledek souboje si nikdo nepřepíše ani nezapíše za druhého

Zkušební účty po testech smazané, databáze je prázdná.

**Fáze 4, gamifikace lokálně** — Dexie, prášky, XP, série, nápovědy,
oprava chybného příkladu a ochrana série.
Celá lekce ověřena offline: po odpojení sítě běží ze service workeru
včetně KaTeXu a jeho písem (73 souborů, 2,2 MB).
Zdrojem pravdy pro hraní je zařízení: aplikace funguje offline a bez účtu.
Ukládá se semínko odpovědi, ne zadání. Každá změna zároveň zapisuje
událost do fronty `outbox`, ze které bude čerpat synchronizace.

**Fáze 7, statistiky a tréninkové režimy** — přehled z uložených
odpovědí, úspěšnost podle látky, opakování chyb a trénink jedné
kategorie. Opakování předloží tentýž příklad se stejnými čísly; to je
celý důvod, proč generátor stojí na semínkách.

**Fáze 8, leštění** — přístupnost prošla auditem axe-core (WCAG 2.1 AA
i doporučené postupy) na všech sedmi obrazovkách: nula nálezů. Zbývá
výkon a zkouška na skutečném iPhonu.

**Vizuální výraz** — rozhraní bylo čisté, ale bez názoru. Zvolený směr je
klinický přístroj: ostré poloměry, popisky verzálkami, čísla strojopisem
(IBM Plex Mono byl v balíku od první fáze a nepoužíval se). Domovská
obrazovka má těžiště v kruhu denního cíle, moment vyhodnocení je odečet
s velkou správnou hodnotou, postup je stupnice po dílcích jako graduace
na stříkačce. Odměna je počítadlo, které doběhne — celé v CSS, bez
časovače.

## Co dělat dál

1. **Ověřit částky ekonomiky proti briefu, sekce 6.** Čísla
   v `src/core/economy.ts` jsou návrh, ne převzaté hodnoty: 2 prášky
   za správný příklad, 10 za bezchybnou lekci, nápověda za 15.
   Všechna jsou na jednom místě.
2. **Doladit výraz podle zpětné vazby.** Směr je nastavený, čeká se,
   co bude na telefonu drhnout.
3. **Zkouška na skutečném iPhonu.** Všechno je zatím ověřené jen
   ve WebKitu na rozměrech telefonu, ne na zařízení.
4. **Vlastní SMTP.** Přihlašovací kódy chodí přes vestavěné SMTP
   Supabase, které má tvrdý limit několika e-mailů za hodinu. Na ostrý
   provoz to nestačí.
5. **Liga.** Žebříček je zatím jen mezi přáteli. Rozdělení do divizí
   a týdenní uzávěrka jsou další krok.
6. **Revize slovenštiny rodilým mluvčím.** Texty jsou napsané, ne
   přeložené strojem, ale nikdo je zatím nečetl. Názvy přípravků zůstávají
   české — fond je z české databáze.
7. **I3** (korekční faktor inzulinu) čeká na zdroj, jinak vypustit.
   Do té doby ji `productionTemplates()` nevydá a test to hlídá.

## Rozhodnutí, která už padla

- Rolovatelné oblasti nesou `tabIndex`, obrazovky mají `main` a lišta
  s klávesnicí je `footer`. Bez toho se obsah ocitl mimo orientační body
  a klávesnicí se k němu nedalo dostat.
- Server je replika, ne podmínka. Přihlášení je nepovinné a bez něj
  aplikace umí všechno kromě porovnání s ostatními.
- Synchronizovat se budou události, ne stav. Dvě zařízení offline nemůžou
  poslat „mám 340 prášků“ — přepsala by se navzájem. Fronta `outbox` proto
  vzniká hned, i když ji zatím nikdo nečte.
- Oprava je druhý pokus, ne přepsání výsledku na správný. Za prášky se
  kupuje šance, ne bod — jinak by se student nic nenaučil.
- Prášky jsou měna, XP je neutratitelné skóre. Zisk XP: 10 za správný
  příklad, +20 za bezchybnou lekci. Lekce má 7 příkladů.
- Tolerance se odvozuje z přesnosti prostředku (ISO 7886-1, IEC 60601-2-24,
  kapkové faktory B. Braun). Je to návrhové rozhodnutí, ne fakt ze zdroje.
- Pásma clearance z SPC jsou zapsaná celými čísly, takže se v nich odečítá
  zaokrouhlená hodnota. Bez toho by clearance 49,1 ml/min spadla mezi pásma.
- Kde je podíl nebo interval součástí ordinace (redukce dávky, počet podání),
  je součástí zadání a netvrdí se jako fakt. Ze zdroje pochází jen rozsah,
  ve kterém se pohybuje.
- Výraz je klinický přístroj, ne hra. Čísla jsou strojopisem, tvary ostré,
  odměna je doběh počítadla — žádné konfety. Červená zůstává jen pro chybu.
- Klávesnice je vlastní, ne systémová. Systémová na iOS překryje spodní
  třetinu obrazovky i s tlačítkem odpovědi.
- Ve výpočetním jádře není text v žádném jazyce. Vzorce sázejí tokeny
  (`\text{@dose}`), jazyk se doplní až při zobrazení. Test to vynucuje tím,
  že jádro smí vracet jen ASCII.
- Zadání je klinická situace, ne holá rovnice: hmotnost, věk a nález
  v jedné větě, otázka na samostatném řádku.
- Faktické údaje pocházejí z DLP a SPC. Výběr účinných látek je kurátorské
  rozhodnutí v `scripts/sukl/latky-vyber.json`; build ověřuje každý název
  proti číselníku ATC.

## Odkazy

- Podklad ke schválení (72 šablon, fond, model tolerance):
  <https://claude.ai/code/artifact/b73f4c6e-6b06-4389-b153-ca8a3f46b19a>
- Zdroje a mapování šablon: `docs/zdroje.md`
- Nástroje na ověřování ze SÚKL: `scripts/sukl/README.md`

## Příkazy

```bash
pnpm test        # 328 testů jádra, překladů, sazby, databáze a statistik
pnpm typecheck
pnpm lint
pnpm dev         # https, LAN, pro test na iPhonu
pnpm build && pnpm preview   # produkční build + offline test
```
