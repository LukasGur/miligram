# Kde jsme

Poslední aktualizace: **28. 9. 2026**

## Hotovo

**Fáze 1** — PWA kostra. Statický export, vlastní service worker s precache
manifestem, instalační lišta, designové tokeny, next-intl. Ověřeno
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
- dar ochrany série pošle jen ten, kdo má odehráno, jednou za týden
  a jen potvrzenému kamarádovi; vyzvedne ho jen příjemce a nic jiného
  než vyzvednutí se na daru změnit nedá

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

**Měna: z prášků pastilky.** Prášky nepůsobily jako odměna. První
pokus (lesklá mince v kulatém čipu) se do aplikace nehodil, druhý
vychází z jejího vlastního jazyka:

- `Pastille` — kresba loga (tableta s rýhou, 24°) v medu, plochá
- doma řádek „Pastilky“ pod sérií a XP, klepnutím do obchodu
- v lekci zůstatek v hlavičce místo počítadla „3/7“, vedle ceny nápovědy
- pastilky za příklad se připisují hned (`recordAnswer`, pole
  `credited`); „+2“ u verdiktu doletí do zůstatku. Lekce na konci přidá
  jen bonus a ten přiletí do zůstatku ve shrnutí
- zvuk „mince“ (dva tóny o kvartu nahoru, Web Audio, relace „ambient“ —
  na iPhonu při vypnutém zvonění mlčí), vypíná se v Nastavení

V kódu a v databázi zůstává `pills`, žádná migrace. Lekce rozehrané
před změnou se doplatí celé. Ověřeno ve WebKitu na rozměru iPhonu celou
lekcí 7/7 (14 za příklady + 10 bonus = 24).

**Fáze 4, gamifikace lokálně** — Dexie, pastilky, XP, série, nápovědy,
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
kategorie. Opakování předloží tentýž výpočet s jinými čísly, ať nestačí
si zapamatovat výsledek.

**Opakování chyb bez bonusu** (25. 9. 2026) — opakování ze statistik
bývá jediný příklad a s bonusem za lekci bez chyby vyneslo 30 XP
a 12 pastilek, skoro jako celá lekce. Plán lekce teď nese `kind: "review"`
a bonus se mu nepočítá, jen 10 XP a 2 pastilky za příklad. Série a počet
lekcí se nemění. Server to ví ze sloupce `lesson_events.kind` (migrace
0007); starší verze aplikace ho neposílají a počítají se jako dosud.

**Program** — učivo v osmi stupních v pořadí opsaném z praktických
cvičení Ústavu farmakologie LF UP (Farmakologie 1 a 2; sylaby
v docs/zdroje.md). Nic se nezamyká: kterýkoli stupeň jde spustit
klepnutím a u stupně, který stojí na nezvládnuté látce, se to napíše
větou. Denní lekce má pět příkladů z rozepsaného stupně a dvě opakování
starší zvládnuté látky na třetí a šesté pozici. Stupeň platí za zvládnutý
při deseti odpovědích a víc než osmdesáti procentech správně napoprvé.

**Fáze 8, leštění** — přístupnost prošla auditem axe-core (WCAG 2.1 AA
i doporučené postupy) na všech sedmi obrazovkách: nula nálezů.

Výkon: první načtení stáhne 849 kB místo 1 295 kB. Fond přípravků
(309 kB) se vezl na domovskou obrazovku dvěma nenápadnými importy —
`LESSON_LENGTH` sídlil vedle sestavování lekce a přehled statistik sahá
přes `categoryOf` na šablony. Klient Supabase (241 kB) se dotahuje až
při použití. Zbývá zkouška na skutečném telefonu (iPhone i Android).

**Vizuální výraz** — rozhraní bylo čisté, ale bez názoru. Zvolený směr je
klinický přístroj: ostré poloměry, popisky verzálkami, čísla strojopisem
(IBM Plex Mono byl v balíku od první fáze a nepoužíval se). Domovská
obrazovka má těžiště v kruhu denního cíle, moment vyhodnocení je odečet
s velkou správnou hodnotou, postup je stupnice po dílcích jako graduace
na stříkačce. Odměna je počítadlo, které doběhne — celé v CSS, bez
časovače.

**Postupy bez skrytých převodů** — H6 ukazovala 2,925 g/l ÷ 58,5 g/mol
a hned vedle 50 mmol/l. Rozměrově to sedí, ale na kalkulačce z toho vyjde
0,05 a tisícovka z mol na mmol v postupu chyběla. H6 má teď mezivýsledek
v mol/l, samostatný krok převodu na mmol/l a krok disociace soli (složení
soli je u elektrolytů v `salt`). Mezivýsledek dosazení se sází za „=“,
ne na samostatný řádek. Všechna dosazení nesou jednotky a test
`dimensions.test.ts` každé přepočítá dvakrát — s jednotkami a jen s čísly
z obrazovky. Našel tím ještě převod mg → g v D2, zamlčený strop dávky
v D3, limit v B3 zaokrouhlený na celé a neescapované `\;` v osmi
šablonách.

**Přihlašovací e-maily** — Supabase posílal výchozí šablonu jen s odkazem,
a ten by z aplikace na ploše otevřel prohlížeč s odděleným úložištěm. Kódy teď chodí
přes vlastní SMTP (Email Profi, doména lukasgurecky.cz se SPF, DKIM
a DMARC; ověřeno na cizím serveru: SPF i DKIM pass). Šablony jsou
v `scripts/supabase/auth-emails.mjs` a nahrávají se odtud, ne v dashboardu.
Kód má šest číslic, platí 15 minut a stojí i v předmětu, takže ho telefon
může nabídnout nad klávesnicí; pole po šesté číslici přihlásí samo.
E-mail přijde česky nebo slovensky podle `locale` v metadatech účtu —
zapíše ho přihlášení a srovná `SyncAgent` po přihlášení a přepnutí jazyka.

**Instalace i na Androidu** — lišta dřív dávala ruční postup jen iPhonu;
Android dostal tlačítko, jen když prohlížeč vyslal `beforeinstallprompt`,
a jinak nic. Teď Android bez výzvy vidí „⋮ Nabídka › Přidat na plochu“.
Chrome a Edge na iOS dostanou stejný postup jako Safari (od iOS 16.4
přidávají na plochu taky) místo odkazu do Safari.

**Notifikace** (25. 9. 2026) — Web Push pro přihlášené, plán a rozhodnutí
v `docs/notifikace.md`. Připomínka série ve zvolený čas (výchozí 19:00),
poslední šance ve 21:30, výzvy a výsledky soubojů, přátelé, dary a liga.
Texty jsou hravé, v `messages/*.json` pod `push`; Edge Function si z nich
bere výtah (`node scripts/build-push-messages.mjs` po každé změně, test
hlídá, že se nerozešly). Komu a kdy rozhoduje databáze (migrace 0008,
pg_cron každou minutu), odesílá Edge Function `push`. Soukromý klíč VAPID,
heslo cronu a adresa funkce jsou ve Vaultu. Nabídka přijde jako poslední
krok registrace (po první přezdívce) a jako záloha ve shrnutí lekce,
obojí s náhledem zamčené obrazovky; vypínač a volby jsou
v Nastavení. Ověřeno v Chromiu: odběr, uvítací notifikace a doručení
z fronty přes FCM až do service workeru.

**Profil, liga a souboje** (26. 9. 2026) — obrazovka účtu byla poskládané
formuláře bez „já“ a souboj byl jen sdílený identifikátor lekce bez pravidel.
Návrh ke schválení: <https://claude.ai/artifact/BWyiZjUXusytWU1BAFqLaw>.

- **Profil** (`src/components/social`) — monogram s odznakem ligy, série,
  XP, lekce a bilance soubojů, dlaždice Liga / Souboje / Přátelé, odznaky,
  nastavení účtu dole. Na domově monogram místo ikony a tečka v akcentu,
  když něco čeká (`src/lib/pulse.ts`, plní ho SyncAgent).
- **Souboj** (migrace 0010, `src/core/duel.ts`) — vyzývající vybere téma
  (mix nebo kategorie), oba hrají tytéž příklady. Vyzvaný má 48 h na
  přijetí, pak oba 48 h na dohrání; kdo nedohraje, prohrává kontumačně,
  jen když druhý dohrál. Bod za správně napoprvé bez nápovědy, při shodě
  kratší čas (pod sekundu remíza). Soupeřovo skóre je zapečetěné do
  vlastního dohrání. Jeden otevřený souboj na dvojici, odveta jedním
  klepnutím. Lhůty hlídá minutová úloha `resolve_duels()`. Výsledek po
  příkladech (migrace 0011) je v odhalení; výsledek dohraný bez sítě
  čeká v localStorage a SyncAgent ho pošle později.
- **Liga** — 5. liga až 1. liga, odznak se stoupajícími sloupky. Odpočet
  do konce týdne, čáry postupu a sestupu, „na postup / do bezpečí chybí
  X XP“, liga přátel jako hlavní pořadí ve skupině pod 9 lidí, výsledek
  minulého týdne při prvním otevření. Nedělní notifikace umí i sestup.
- **Přátelé** — QR kód a skener přímo v aplikaci (jsQR, stáhne se až se
  skenerem; odkaz z foťáku by na iPhonu otevřel Safari bez přihlášení),
  odkaz ke sdílení se stránkou pozvánky (`/?pritel=…`) a vložením ze
  schránky, přezdívka. Profil přítele: vzájemná bilance, srovnání
  v kategoriích (funkce `friend_template_stats`, jen pro přátele), dar,
  odebrání.
- **Odznaky** (`src/core/badges.ts`) — 10, tři stupňované. Dosažený stupeň
  se ukládá na zařízení (Dexie verze 7) a nemizí; nové z lekce se ukážou
  ve shrnutí.

Ověřeno ve WebKitu na rozměru iPhonu s podvrženými odpověďmi serveru;
pravidla proti živé databázi dotazem (`duel_outcome`, `resolve_duels`).
Na telefonu se dvěma účty to ještě nikdo nehrál.

**Soukromí úspěšnosti** (26. 9. 2026) — kamarádi vidí snahu (série, XP,
liga, odznaky), úspěšnost napoprvé a chyby ne. Srovnání podle kategorií
v profilu přítele nahradily jeho odznaky; výběr tématu v nové výzvě ukazuje
jen vlastní procenta; v odhalení souboje se soupeřova nápověda ukazuje jako
„bez bodu“. Server funkci `friend_template_stats` zrušil (migrace 0012)
a profil nese `badges` — dosažené stupně, které si zapíše zařízení.

**Výzva na jedno klepnutí.** Vyzvat kamaráda stálo pět klepnutí přes
seznam soubojů a obrazovku s tabulkou podmínek, a tak se skoro nevyzývalo.
Obrazovka `NewDuel` je pryč a místo ní je `ChallengeSheet`, spodní list
se soupeřem, tématem jako čipem a podmínkami na jednom řádku (celé pod
odkazem). Otevírá se tam, kde chuť vzniká:

- po dohrané lekci karta s řadou kamarádů, téma je převažující kategorie
  lekce (`lessonTopic`), jinak mix; kdo kamarády nemá, dostane pozvánku
- „Odveta“ na odhalení výsledku, stejný soupeř i téma
- v profilu karta Soubojů s řadou monogramů, klepnutí rovnou vyzve

**Monogramy.** Kruh všude, tlumený podklad a tmavé iniciály téhož tónu
místo sytých plných barev. Tón si každý vybere klepnutím na vlastní
monogram v profilu (`profiles.tone`, migrace 0013, v živé databázi);
kdo nevybral, má dál ten z přezdívky. Tóny cizích profilů si pamatuje
`src/lib/tones.ts`, takže se nemusí protahovat každým seznamem.

**Data ze serveru: zneplatnění po zápisu.** Po dohraném souboji profil
ukazoval „tvůj tah“, protože mezipaměť dotazů (`src/lib/remoteQuery.ts`)
neznala zneplatnění a obrazovky volaly `refresh()` ručně, jen někde.
Teď platí:

- každý zápis v `src/lib/remote.ts` jde přes `mutated(…)` a zneplatní
  dotazy, kterých se týká (tabulka `AFFECTS`), i když spadne — odpověď
  se mohla ztratit, změna na serveru ne; obrazovky `refresh()` nevolají
- data starší než 30 s se stáhnou znovu, když se obrazovka otevře nebo
  se aplikace vrátí do popředí; otevřený profil se ptá na souboje
  a žádosti jednou za minutu
- při obnově zůstávají vidět předchozí data a pozdě doražená starší
  odpověď nepřepíše novější
- výsledek souboje, který telefon zná a server ještě ne
  (`src/lib/duelPending.ts`), se promítá do seznamu soubojů hned

Nový dotaz: klíč `jméno:…`, jméno doplnit do `AFFECTS` u zápisů, které
ho mění.

**Spotřeba dat.** Změřeno z edge logů a v Chromiu:

- nová verze aplikace si stáhne jen změněné soubory: precache nese otisk
  každého souboru a nezměněné převezme z předchozí cache (ověřeno: změna
  index.html = 2 požadavky místo 90, dřív ~3 MB při každém nasazení)
- SyncAgent běží jednou za běh aplikace, ne s domovskou obrazovkou —
  dřív každý návrat z lekce nebo profilu spustil celou výměnu znovu
- SyncAgent čte přes `fetchQuery` z téže mezipaměti jako obrazovky
- nastavení upozornění a registrace zařízení se zapisují jen při změně

**Účty a peněženka (28. 9. 2026, plán fáze A)** — data v telefonu mají
vlastníka a synchronizace mluví jen za něj. Dřív odhlášení nic nesmazalo
a kdo se přihlásil po někom jiném, viděl jeho skóre, sérii i chyby.

- registrace si vezme, co se odehrálo bez účtu; přihlášení k účtu, který
  už má historii, ukáže, co z telefonu zmizí, a smaže to až po potvrzení
  („Zpět“ přihlášení zruší); odhlášení nejdřív odešle frontu, pak telefon
  vyčistí — a odhlašuje už jen tenhle telefon, ne všechny
- pastilky a ochrany na serveru (`wallet_events`, `my_wallet`), takže
  se přenesou do nového telefonu a dvě zařízení se doženou; dosavadní
  zůstatek se pošle jednou jako počáteční stav (Dexie verze 8)
- 30 pastilek za založení účtu (`claim_signup_bonus`), karta ve výhodách
  a výzva na konci 1. a 3. lekce nepřihlášenému
- série na serveru se skládá z dní s lekcí a dní podržených ochranou
  (`recompute_streak`); kamarádi tak vidí sérii, kterou podržela ochrana
- opravená chyba: obnova při každém spuštění přepočítala sérii z historie
  bez ochran, takže ochrana přihlášenému vydržela jen do dalšího spuštění

**Učící krok (28. 9. 2026, plán fáze B)** — nový typ příkladu už nepřijde
bez pomoci. U šablony, kterou student ještě nespočítal sám, stojí
v řádku pomůcek místo nápovědy **Vzor**: vyřešený příklad téhož typu
s jinými čísly (obtížnost 1), i se zdroji, v listu zespodu. Úplně
poprvé na něj ukáže bublina, pak už nikdy. Souboj to nemá.

Původně vzor naskakoval sám přes celou obrazovku před prvním příkladem
typu. Kdo věděl, jak na to, musel ho pokaždé odklepnout — zrušeno.

- otevření vzoru se počítá jako pomoc, stejně jako nápověda: typ se vrátí
  v opakování příští denní lekce („Minule s pomocí, teď bez ní“)
  a zvládnutý je až spočítaný napoprvé bez vzoru i nápovědy. XP ani
  pastilky pomoc nebere
- u zvládnutého typu je nápověda za 15 pastilek a odkrývá postup po
  krocích: popis a vzorec, u kroku bez vzorce dosazení bez výsledku
- opakování chyb ve statistikách pomoc za chybu nemá
- věta „proč se to tak počítá“ se v listu vzoru ukáže, až bude
  v překladech (`exercise.why.<šablona>`, návrh v docs/proc-texty.md)

**Obnovení série (28. 9. 2026, plán fáze C)** — spadlou sérii jde krátce
po ztrátě obnovit za 200 pastilek: jen u série aspoň 7 dní, do konce
druhého dne po ztrátě, nejvýš jednou za 30 dní. Karta je na domovské
obrazovce nad denním cílem a jde odmítnout. Obnovené dny se zapíšou jako
pokryté (jako den podržený ochranou), takže platí obě situace: kdo ještě
nehrál, má sérii zpátky hned; kdo už začal od jedničky, tomu se stará
řada spojí s novou.

- server obnovení hlídá sám (`check_repair`, migrace 0015): jen nedávný
  den a jedno placené obnovení za 30 dní; ověřeno v transakci na živé
  databázi
- `stats.streak_through` — kam série sahá přes pokryté dny; kamarádi
  a připomínky počítají s ním, ne jen s dnem poslední lekce

## Co dělat dál

**Rozpracovaný plán: [plan.md](plan.md)** — účty a pastilky na serveru
(oprava úniku dat mezi účty), učící krok, obnovení série.

0a. **Souboj naostro na dvou telefonech.** Výzva, přijetí, hraní obou,
   odhalení, odveta; skener QR na iPhonu z plochy (kamera v PWA).


0. **Notifikace na iPhonu a Androidu.** Na iPhonu jen z plochy (iOS 16.4+).
   Zkusit: nabídku po lekci, uvítací notifikaci, klepnutí na připomínku
   (má otevřít lekci), přepnutí času v Nastavení.

1. **Doladit výraz podle zpětné vazby.** Směr je nastavený, čeká se,
   co bude na telefonu drhnout.
2. **Zkouška na skutečném telefonu — iPhone i Android.** Všechno je
   zatím ověřené jen ve WebKitu na rozměrech telefonu, ne na zařízení.
   Na Androidu hlavně instalace (Chrome, Samsung Internet, Firefox),
   vlastní klávesnice a vložení kódu z e-mailu.
3. **Sledovat limity odesílání.** Kódy chodí přes Email Profi
   (smtp.seznam.cz) ze schránky miligram@lukasgurecky.cz. Seznam limity
   pro schránky nezveřejňuje; kdyby kódy přestaly chodit, přesunout
   odesílání na transakční službu (Resend) — mění se jen SMTP údaje.
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
- Od druhé chyby na témže příkladu se dá jít dál s ukázaným postupem.
  Bez toho by v lekci uvízl ten, kdo látku nezná — a to je přesně trest
  začátečníka, kvůli kterému Duolingo letos zrušilo srdce.
- Program nezamyká. Výpočty dávkování nejsou kumulativní jako jazyk
  a medik před zkouškou má právo jít rovnou na to, co potřebuje. Pořadí
  je doporučení; závislost stupňů slouží k jedné větě, ne k zákazu.
- Lekci určuje buď identifikátor, nebo uložený plán. Sdílená lekce
  (souboj) se sestaví z identifikátoru a nesmí záviset na stavu
  uživatele — dva hráči nemají stejný stav. Osobní lekce (program,
  trénink, opakování chyb) si plán uloží k rozehrané lekci.
- Kategorie šablony se čte z ploché tabulky, ne přes registr. Program
  se počítá na domovské obrazovce a ta nesmí kvůli němu stáhnout fond
  614 přípravků. Test hlídá, že se tabulka se šablonami nerozejde.
- Odměna se počítá z prvního pokusu. Opakování je na učení, ne na sbírání
  bodů, a na server jde jeden záznam na příklad — kdyby se posílaly
  pokusy, přičetly by XP.
- Opakovaný příklad přijde s jinými čísly: stejná šablona, stejná
  obtížnost, nové semínko. Správná hodnota je vidět ve verdiktu hned po
  chybě, takže se stejnými čísly by se z opravy stal opis. Platí to
  i pro režim opakování chyb.
- Zadání nesmí obsahovat odpověď. Hlídá to test nad vykresleným textem
  všech 72 šablon; hlásí soustavnou shodu, protože u malých čísel se
  odpověď se zadáním potká i náhodou.
- Kalkulačka je uvnitř aplikace a u každého příkladu. Systémovou nejde
  na iOS otevřít a dělit příklady na ty, kde se „smí“ počítat, by byl
  zákaz, který stejně nejde vynutit. Cvičí se postavení výpočtu.
- Pastilky drží server jako součet pohybů (od 28. 9. 2026, migrace 0014).
  Dar je dál událost, ne převod zůstatku. Pastilky jsou soukromé, proto
  server pohyby od telefonu přijímá a hlídá jen meze; XP, které řadí ligu,
  počítá sám.
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
- Čísla v dosazení musí dát mezivýsledek na kalkulačce tak, jak stojí.
  Převod jednotek je vlastní krok, nikdy není schovaný v rovnítku.
  Výjimkou jsou empirické vzorce (Mosteller, Cockcroft–Gault), jejichž
  konstanty rozměr nesou skrytě — test je má vyjmenované.
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
pnpm test        # 425 testů jádra, překladů, sazby, databáze a statistik
pnpm typecheck
pnpm lint
pnpm dev         # https, LAN, pro test na telefonu
pnpm build && pnpm preview   # produkční build + offline test
```
