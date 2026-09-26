# Notifikace — plán

Založeno 25. 9. 2026. Web Push pro přihlášené, odesílá Supabase.

**Stav (25. 9. 2026):** body 1–7 z pořadí prací hotové, ověřené
v Chromiu včetně doručení přes FCM. Chybí zkouška na iPhonu a Androidu.
Oproti plánu nevznikla tabulka `push_log` — záznamem o odeslaném je
sama fronta (`sent_at`, `outcome`), cron ji čistí po třiceti dnech.

## Rozhodnutí

- **Jen pro přihlášené.** Server zná jejich lekce, takže připomínka přijde
  jen tomu, kdo ten den ještě necvičil. Bez účtu by chodila naslepo.
  Notifikace se tím stávají dalším důvodem k přihlášení a obrazovka účtu
  je mezi výhodami uvede.
- **Hravý tón.** Krátce, s číslem a jedním emoji. Hravost je v textu,
  ne v rozhraní — v aplikaci zůstává klinický přístroj.
- **Připomínka série ve zvolený čas** (výchozí 19:00) a **poslední šance
  ve 21:30**, když série má aspoň 3 dny a lekce pořád chybí. Poslední
  šance má vlastní vypínač. Víc než dvě připomínky série za den nikdy.
- **Nabídka hned po registraci** (26. 9. 2026), jako poslední krok po
  zvolení první přezdívky: celá obrazovka s náhledem a volbou času.
  Zapnout rovnou bez ptaní nejde — prohlížeč posílá jen po povolení
  a iOS ukáže dotaz jen po klepnutí. Krok se neukáže tam, kde zapnout
  nejdou (iPhone v prohlížeči, zablokované povolení). „Teď ne“ se počítá
  jako první odmítnutí.
- **Nabídka po dohrané lekci** zůstává jako záloha, ve shrnutí lekce.
  Systémový dotaz na povolení až po klepnutí. Kdo nabídku odmítne, uvidí
  ji znovu nejdřív za týden, nejvýš třikrát celkem (včetně kroku po
  registraci). V Nastavení je vypínač vždycky.
- **Backend v Supabase**: tabulky, `pg_cron`, `pg_net` a jedna Edge
  Function. Žádná další služba.

## Co chodí

| Druh | Kdy | Příklad (cs) | Vypínač |
|---|---|---|---|
| Série | zvolený čas, jen bez dnešní lekce | 12 dní v kuse. Dnes to přece nepokazíš? 💊 | Připomínka série |
| Poslední šance | 21:30, série ≥ 3, pořád bez lekce | Série 12 dní končí o půlnoci. Stačí 5 minut ⏳ | Poslední šance |
| Výzva na souboj | hned | ⚔️ {handle} tě vyzývá na souboj. Ukaž, kdo líp počítá kapky! | Kamarádi |
| Souboj dohrán | hned, když soupeř dohraje | {handle} má odehráno: 6/7. Tvůj tah 👀 | Kamarádi |
| Žádost o přátelství | hned | {handle} si tě chce přidat mezi kamarády 👋 | Kamarádi |
| Žádost přijata | hned | {handle} je teď mezi kamarády. Čas na souboj? ⚔️ | Kamarádi |
| Dar ochrany | hned | Dar od {handle}: ochrana série 🎁 | Kamarádi |
| Liga: poslední den | neděle 18:00, jen kdo tento týden hrál | Poslední den ligy! Jsi 4., na postup chybí 30 XP 🔥 | Liga |
| Liga: výsledek | pondělí 9:00 | Postup do divize Stříbro! 🏆 / Týden skončil 8. místem | Liga |

**Rod.** Přezdívka neříká, jestli je to on, nebo ona. Texty se proto píšou
v přítomném čase nebo bez slovesa v minulém čase („{handle} tě vyzývá“,
„Dar od {handle}: ochrana série 🎁“), nikdy „vyzval/a“.

**Strop.** Mimo sérii nejvýš 4 notifikace za den na uživatele. Přes noc
(21:45–8:00 místního času) se sociální a ligové neposílají, počkají do
rána. Víc výzev od téhož kamaráda se slije do jedné (`tag`).

## Architektura

```
klient ──subscribe──▶ push_subscriptions ◀── notification_prefs
                                 ▲
spouštěče (duels, duel_results,  │
friendships, gifts) ──insert──▶ push_queue
                                 │
pg_cron každou minutu ─ (fronta neprázdná / je čas připomínek) ─▶ pg_net
                                 │
                                 ▼
                    Edge Function `push` ──Web Push (VAPID)──▶ Apple / Google
```

### Databáze (migrace `0008_notifikace.sql`)

- `push_subscriptions` — `endpoint` (PK), `user_id`, `p256dh`, `auth`,
  `user_agent`, `created_at`, `last_ok_at`. Jedno zařízení = jeden řádek,
  uživatel jich může mít víc. RLS: vlastní řádky vidí, zapisuje a maže
  jen majitel.
- `notification_prefs` — `user_id` (PK), `locale`, `time_zone`
  (IANA z prohlížeče), `reminder_time` (time, výchozí 19:00),
  `streak`, `last_chance`, `social`, `league` (boolean),
  `streak_days`, `last_lesson_day`. Poslední dvě posílá klient — série
  na serveru nezná ochrany, které žijí v telefonu, a v textu musí stát
  totéž číslo, které student vidí doma. Server je použije jen do textu;
  o tom, jestli se má připomínat, rozhoduje `lesson_events`.
- `push_queue` — `id`, `user_id`, `kind`, `params` (jsonb), `tag`,
  `not_before`, `created_at`, `sent_at`, `attempts`. Plní ji spouštěče
  a naplánovaná funkce, vybírá Edge Function.
- Spouštěče `after insert` na `duels`, `duel_results`, `friendships`
  (insert i update na `accepted`), `gifts` → řádek do `push_queue`.
- `enqueue_reminders()` — každou minutu vybere uživatele, jejichž místní
  čas právě dosáhl `reminder_time` (nebo 21:30), nemají lekci v místním
  dni a dnes ten druh ještě nedostali. Ligové zprávy stejně podle
  místního času neděle/pondělí.
- `pg_cron`: každou minutu `enqueue_reminders()`; když je ve frontě něco
  splatného, `pg_net` zavolá Edge Function. Prázdná fronta = žádné volání.
- Klíče: soukromý VAPID a sdílené heslo cron → funkce ve Vaultu.

### Edge Function `supabase/functions/push`

- Přijme volání jen se sdíleným heslem.
- Vybere splatné řádky fronty, sloučí podle `tag`, ověří strop a noc,
  složí text v jazyce příjemce a pošle na všechna jeho zařízení.
- 404/410 → odběr smaže. Chyba sítě → `attempts + 1`, po třech zahodit.
- Texty: jmenný prostor `push` v `messages/cs.json` a `sk.json`.
  Skript `scripts/build-push-messages.mjs` z nich vygeneruje
  `supabase/functions/push/messages.ts`; test hlídá, že se nerozešly.
  Plurály přes `intl-messageformat` (už je v projektu).
- Knihovna: `jsr:@negrel/webpush` (Web Crypto, běží v Deno bez Node API).

### Service worker (`scripts/sw.template.js`)

- `push` → `showNotification(title, { body, icon, badge, tag, data, lang,
  timestamp })`. Každý push musí ukázat notifikaci — iOS jinak odběr
  po třech tichých zrušil.
- `notificationclick` → zaostří otevřené okno, nebo otevře nové, s cílem
  v `data.url` (`/?open=duels`, `/?open=friends`, `/?open=league`,
  `/?lesson=daily`).
- `pushsubscriptionchange` → přihlásí se znovu a pošle nový odběr.
- Na Androidu tlačítko akce „Spustit lekci“ u připomínky série.

### Klient

- `src/lib/push.ts` — stav (nepodporováno / chce instalaci / nerozhodnuto
  / povoleno / zablokováno), `enablePush()`, `disablePush()`,
  převod veřejného klíče, zápis odběru a preferencí.
- `SyncAgent` — srovná `notification_prefs.locale`, `time_zone`,
  `streak_days` a `last_lesson_day` po lekci a po přepnutí jazyka.
  Při odhlášení odběr zařízení smaže.
- `page.tsx` — přečte `?open=` / `?lesson=` a otevře obrazovku.
- Veřejný klíč VAPID jako konstanta v kódu (je veřejný), ne proměnná
  prostředí — Cloudflare build na ní pak nezávisí.

## Rozhraní

Grafika podle výrazu aplikace: ostré tvary, popisky verzálkami, čísla
strojopisem, akcent indigo, červená jen pro chybu.

1. **Karta ve shrnutí lekce** — nad tlačítkem Domů, pod odměnou.
   Hlavní prvek je **náhled skutečné notifikace**: bílý panel ve tvaru
   upozornění na zamčené obrazovce s ikonou aplikace, „Miligram · 19:00“
   a textem s jeho vlastní sérií. Student vidí přesně, co dostane.
   Pod tím čas jako čip (klepnutím změní) a dvě akce: „Připomínat“
   (primární) a „Teď ne“ (tichá). Náhled vjede zespodu stejnou křivkou
   jako ostatní listy (`--ease-decel`), s omezeným pohybem se jen objeví.
2. **Nastavení → Upozornění** — hlavní vypínač, pod ním řádek „Čas
   připomínky“ s nativním `<input type="time">` (na iOS kolečko),
   a vypínače Poslední šance, Kamarádi, Liga. Hint pod sekcí vysvětluje,
   že připomínka nepřijde, když už je hotovo.
3. **Stavy, které se musí vysvětlit samy:**
   - bez účtu → věta a tlačítko „Přihlásit se“
   - iPhone v prohlížeči → „Upozornění fungují po přidání na plochu“
     a rovnou `InstallSteps`
   - zablokováno → postup, kde to povolit (iOS: Nastavení › Oznámení ›
     Miligram; Android: zámek v adresním řádku / informace o aplikaci)
   - starý iOS bez podpory → jedna věta, nic víc
4. **Obrazovka účtu** — mezi výhodami přihlášení přibude „Připomínky
   série“.
5. **Ikona `badge`** — jednobarevná silueta tablety s rýhou,
   96 × 96, bílá na průhledné. Android ji dává do stavového řádku, kde
   plná ikona aplikace vyjde jako bílý čtverec. Generuje `make-icons.mjs`.

## Pořadí prací

1. **Migrace a klíče** — tabulky, RLS, Vault, rozšíření. Ověřit politiky
   proti živé databázi publikovatelným klíčem jako u přátel.
2. **Service worker a `push.ts`** — odběr, zápis, zrušení, stavy.
3. **Edge Function a texty** — odeslání, generované zprávy, test synchronu.
4. **Připomínka série** — `enqueue_reminders`, cron, poslední šance.
5. **Rozhraní** — karta ve shrnutí, sekce v Nastavení, stavy, badge.
6. **Sociální a liga** — spouštěče, noc, strop, slučování.
7. **Hluboké odkazy** — `?open=` a akce na Androidu.
8. **Ověření** — Chromium (odběr, zobrazení, klepnutí), iPhone z plochy,
   Android. Zapsat do `docs/stav.md`.

## Rizika

- **Offline lekce.** Kdo cvičil bez sítě, server o tom neví a připomínka
  přijde. Service worker ji potlačit nesmí (iOS by odběr zrušil), takže
  se to zmírňuje jen tím, že fronta odejde hned, jak je síť — obvykle
  dávno před 19:00.
- **Ochrana série** je v telefonu. Připomínka proto neříká „série
  skončí“, když může mít zásobu; formulace počítá s tím, že ochrana
  existuje („Dnes to přece nepokazíš?“), ne s jistotou konce.
- **iOS** doručuje jen aplikaci z plochy (16.4+) a každý push musí
  zobrazit notifikaci.
- **Limit Edge Functions** na zdarma plánu je 500 000 volání měsíčně;
  cron volá jen při neprázdné frontě, takže jde o stovky až tisíce.
