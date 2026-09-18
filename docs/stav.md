# Kde jsme

Poslední aktualizace: **18. 9. 2026**

## Hotovo

**Fáze 1** — PWA kostra. Statický export, vlastní service worker s precache
manifestem, iOS instalační lišta, designové tokeny, next-intl. Ověřeno
offline v Chromiu i vizuálně ve WebKitu.

**Fáze 2, jádro** — `src/core`: jednotky, vzorce, tolerance odvozená z norem
prostředků, deterministický generátor, fond 614 přípravků ze SÚKL,
tabulky dávkovacích rozmezí, rekonstituce a elektrolytů opsané ze SPC.

**Fáze 2, šablony** — hotovo **72 ze 72** včetně českých a slovenských
textů, a všech 72 je v produkčním setu. Testů prochází 362. Poslední
chyběla I3: pravidlo 100 uvádí doporučený postup ISPAD 2022, což je jiný
druh zdroje než SPC, a CLAUDE.md proto od 18. 9. 2026 doporučené postupy
odborných společností připouští — s plnou citací a s tím, že odhad pro
začátek musí být jako odhad napsaný.

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
| I inzulin | I1–I4 | — |
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
- vlastní historie se stáhne celá, cizí ani anonymovi ani přihlášenému ne

**Stahování ze serveru.** Fronta byla jednosměrná: kdo se přihlásil
na novém telefonu, viděl doma nulu a vedle v lize svoje skutečné XP.
Stahuje se totéž, co se posílá — co se stalo —, a skóre i série se z toho
počítají znovu týmiž pravidly. Poprvé na účet přijde celá historie,
podruhé a dál jen to, co je novější než nejnovější známá lekce; běžné
spuštění tak zaplatí jeden dotaz a nevrátí nic. Tím se zároveň doženou
dvě zařízení téhož uživatele.

Ověřeno proti živé databázi: XP spočítané ze stažených dat sedí na XP,
které si spočítal spouštěč na serveru, hranice podle času vrací jen
novinky a lekce zapsaná „z druhého zařízení“ dorazí. Slučuje se podle
`lessonId`, takže na pořadí odeslání a stažení nezáleží a opakované
stažení skóre nenafoukne. Prášky se neobnovují — server zná výdělek,
ne útratu.

Zkušební účty po testech smazané, databáze je prázdná.

**Fáze 4, gamifikace lokálně** — Dexie, prášky, XP, série, nápovědy,
oprava chybného příkladu a ochrana série. Každá odpověď se ukládá hned,
ne až po dohrané lekci: rozehraná lekce přežije odchod z obrazovky
i zavření aplikace a domovská obrazovka nabídne „Pokračovat · 3/7“.
Celá lekce ověřena offline: po odpojení sítě běží ze service workeru
včetně KaTeXu a jeho písem (82 souborů, 2,5 MB).
Zdrojem pravdy pro hraní je zařízení: aplikace funguje offline a bez účtu.
Ukládá se semínko odpovědi, ne zadání. Každá změna zároveň zapisuje
událost do fronty `outbox`, ze které bude čerpat synchronizace.

**Fáze 7, statistiky a tréninkové režimy** — přehled z uložených
odpovědí, úspěšnost podle látky, opakování chyb a trénink jedné
kategorie. Opakování předloží tentýž příklad se stejnými čísly; to je
celý důvod, proč generátor stojí na semínkách.

**Fáze 8, leštění** — přístupnost prošla auditem axe-core (WCAG 2.1 AA
i doporučené postupy) na všech sedmi obrazovkách: nula nálezů.

Výkon: první načtení stáhne 849 kB místo 1 295 kB. Fond přípravků
(309 kB) se vezl na domovskou obrazovku dvěma nenápadnými importy —
`LESSON_LENGTH` sídlil vedle sestavování lekce a přehled statistik sahá
přes `categoryOf` na šablony. Klient Supabase (241 kB) se dotahuje až
při použití. Zbývá zkouška na skutečném iPhonu.

**Vizuální výraz** — rozhraní bylo čisté, ale bez názoru. Zvolený směr je
klinický přístroj: ostré poloměry, popisky verzálkami, čísla strojopisem
(IBM Plex Mono byl v balíku od první fáze a nepoužíval se). Domovská
obrazovka má těžiště v kruhu denního cíle, moment vyhodnocení je odečet
s velkou správnou hodnotou, postup je stupnice po dílcích jako graduace
na stříkačce. Odměna je počítadlo, které doběhne — celé v CSS, bez
časovače.

## Co dělat dál

1. **Doladit výraz podle zpětné vazby.** Směr je nastavený, čeká se,
   co bude na telefonu drhnout.
2. **Zkouška na skutečném iPhonu.** Všechno je zatím ověřené jen
   ve WebKitu na rozměrech telefonu, ne na zařízení.
3. **Vlastní SMTP.** Přihlašovací kódy chodí přes vestavěné SMTP
   Supabase, které má tvrdý limit několika e-mailů za hodinu. Na ostrý
   provoz to nestačí.
4. **Ověřit ligu na skutečném provozu.** Postup a sestup se počítají až
   při první lekci v novém týdnu, takže se to pozná nejdřív za týden.
5. **Revize slovenštiny rodilým mluvčím.** Texty jsou napsané, ne
   přeložené strojem, ale nikdo je zatím nečetl. Názvy přípravků zůstávají
   české — fond je z české databáze.

## Rozhodnutí, která už padla

- Rolovatelné oblasti nesou `tabIndex`, obrazovky mají `main` a lišta
  s klávesnicí je `footer`. Bez toho se obsah ocitl mimo orientační body
  a klávesnicí se k němu nedalo dostat.
- Liga nemá naplánovanou úlohu. Přeřazení se počítá ve chvíli, kdy se
  uživatel v novém týdnu poprvé ozve — naplánovaná úloha by musela běžet
  i pro účty, které se týden neozvaly, a musela by se hlídat.
- Server je replika, ne podmínka. Přihlášení je nepovinné a bez něj
  aplikace umí všechno kromě porovnání s ostatními.
- Synchronizovat se budou události, ne stav. Dvě zařízení offline nemůžou
  poslat „mám 340 prášků“ — přepsala by se navzájem. Fronta `outbox` proto
  vzniká hned, i když ji zatím nikdo nečte.
- Odpověď se ukládá hned, odměna až za celou lekci. Dnešní cíl i statistiky
  proto počítají i s nedohranou lekcí, ale XP a prášky ne: v odměně je
  bonus za bezchybný průchod a server ji počítá ze všech odpovědí naráz.
- Události mají vlastní uid, ne pořadové číslo z Dexie. Pořadová čísla se
  po přeinstalaci i na druhém zařízení opakují a server by takovou lekci
  zahodil jako duplicitu.
- Den se počítá podle kalendáře uživatele, ne podle UTC. Uložený čas je
  v UTC a ukrajovat z něj prvních deset znaků znamená, že lekce dohraná
  po půlnoci padne na včerejšek.
- Chybný příklad se v lekci vrací se stejnými čísly, dokud nevyjde. Lekce
  je hotová po sedmi spočítaných příkladech, ne po sedmi odpovědích —
  sedm chyb ze sedmi proto neznamená splněný denní cíl. Placená oprava
  tím ztratila smysl a zmizela: druhý pokus má nově každý a zadarmo.
- Odměna se počítá z prvního pokusu. Opakování je na učení, ne na sbírání
  bodů, a na server jde jeden záznam na příklad — kdyby se posílaly
  pokusy, přičetly by XP.
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
pnpm test        # 362 testů jádra, překladů, sazby, databáze a statistik
pnpm typecheck
pnpm lint
pnpm dev         # https, LAN, pro test na iPhonu
pnpm build && pnpm preview   # produkční build + offline test
```
