# Plán: účty, učící krok, obnovení série

Domluveno 28. 9. 2026. Pořadí fází je závazné: B stojí na tom, že
pastilky drží server (A2), C na tom i na opravě série (A5).

Výchozí stav, kvůli kterému se to dělá:

- Data v telefonu (Dexie) nepatří žádnému účtu a odhlášení je nesmaže.
  Po odhlášení A a přihlášení B vidí B skóre, sérii, statistiky i chyby
  studenta A a stažená historie B se s nimi smíchá. Porušuje to pravidlo
  „úspěšnost a chyby vidí jen student“.
- Pastilky zná jen telefon. Server ví o výdělku, ne o útratě, takže
  na novém telefonu začíná student od nuly.
- Obnova historie skládá sérii bez použitých ochran
  (`streakFromHistory` v `src/lib/restore.ts`) — obnovená série vyjde
  kratší, než byla.
- Student potkává nový typ příkladu naslepo. Učí se až z chyby.

## Fáze A — účty a pastilky na serveru ✅ (28. 9. 2026)

### A1. Data v telefonu patří jednomu účtu

- **Registrace (účet bez historie):** všechno z telefonu se k účtu
  připíše, bez ptaní.
- **Přihlášení k existujícímu účtu, když je v telefonu něco odehrané bez
  účtu:** data z telefonu se vždy zahodí, ale nejdřív se to řekne.
  Upozornění přijde hned po ověření kódu z e-mailu (dřív aplikace neví,
  že účet existuje) a před smazáním. Obsah:
  - že účet už má svoje data,
  - kolik lekcí odehraných na tomhle telefonu se smaže (i rozehraná),
  - že kdo je chce zachovat, má se zaregistrovat jiným e-mailem.
  Hlavní akce „Přihlásit a smazat“, vedlejší „Zpět“ — ta přihlášení
  zruší a data v telefonu nechá. Když v telefonu nic není, upozornění
  se neukáže.
- **Odhlášení:** nejdřív se odešle fronta (jako dnes), pak se telefon
  vyčistí — lekce, odpovědi, profil, dary, rozehraná lekce. Potvrzení
  řekne, že data zmizí z telefonu a na účtu zůstanou.
- **Přihlášení jiného účtu, než komu data patří:** vyčistit a stáhnout
  historii nového účtu. (Po A1 by k tomu nemělo dojít, ale pojistka
  zůstane — např. vypršelá relace.)

### A2. Pastilky a ochrany drží server

- Nová migrace: tabulka pohybů pastilek, každý pohyb s vlastním id
  (idempotence).
- Příjem (příklady, bonus za lekci, souboje) počítá server z toho, co
  zná, stejně jako XP.
- Útrata (nápověda, ochrana, dar, později obnovení série) jde z telefonu
  stávající frontou.
- Zůstatek = součet pohybů. Telefon dál funguje offline a při
  synchronizaci se srovná.

### A3. Přechod současných uživatelů

Telefon jednou pošle aktuální zůstatek pastilek a počet ochran jako
počáteční stav. Server ho přijme jen jednou na účet.

### A4. 30 pastilek za registraci

- Nový uživatel začíná s nulou — nápovědu u nového typu má zdarma (B2).
- 30 pastilek jednou na účet, hlídá server.
- Kde se to říká:
  - řádek v „Co s účtem získáš“ na stránce Účet,
  - výzva na obrazovce konce lekce po **1. a 3.** dokončené lekci,
    jen nepřihlášenému. Hlavní argument je uložení postupu a série,
    pastilky jsou navíc.

### A5. Obnova historie počítá sérii s ochranami

Použití ochrany se musí dostat do historie, aby ho obnova znala.

### Testy fáze A

Přepnutí účtu nesmíchá data; upozornění před smazáním; pohyb pastilek
se nezapočítá dvakrát; počáteční stav i bonus jen jednou na účet;
obnovená série sedí i s ochranami.

## Fáze B — učící krok ✅ B1–B3 (28. 9. 2026), B4 čeká na kontrolu textů

Platí v denní lekci a tréninku. **Souboj zůstává beze změny** — oba
hrají za stejných podmínek.

### B1. Karta „Nový typ příkladu“

Když student šablonu ještě nikdy nepočítal, před příkladem dostane:

- jednu větu, proč se to tak počítá,
- vyřešený vzor s jinými čísly krok po kroku (kroky už existují,
  `SolutionSteps`; vzor = tatáž šablona s jiným seedem),
- tlačítko „Zkusím sám“.

Během příkladu jde vzor znovu otevřít.

### B2. Nápověda postupně, krok po kroku

- Klepnutí odkryje další krok.
- Nový typ: zdarma, dokud ho student nevyřeší bez nápovědy.
- Známý typ: 15 pastilek odemkne všechny kroky.

### B3. Po nápovědě se typ vrátí

Kdo si vzal nápovědu (zdarma i placenou), dostane týž typ s jinými
čísly v opakovacím slotu příští lekce. U nápovědy věta „Příště to zkusíš
bez nápovědy.“

### B4. Texty

Věty „proč“ pro 72 šablon, CS i SK. Před nasazením je projde autor
(přehledný seznam k přečtení), teprve pak push.

Napsané v `docs/proc-texty.md`, čekají na kontrolu. Po schválení se
vloží do `messages/*.json` jako `exercise.why.<šablona>` — karta je
ukáže sama, kód je hotový.

## Fáze C — obnovení série ✅ (28. 9. 2026)

- 200 pastilek.
- Nabídka do 48 h po ztrátě, jen u série aspoň 7 dní, nejvýš 1× za 30 dní.
- Nabídka na domovské obrazovce.
- Migrace: server musí o obnovení vědět, aby sérii viděli i kamarádi.

## Drobnost ✅

Komentář v `src/core/economy.ts` odkazoval na „brief, sekci 6“ — takový
dokument v projektu není. Přepsáno.
