# Miligram

Trénink výpočtů dávkování léků pro české a slovenské studenty medicíny.
Progressive Web App — instaluje se přidáním na plochu, funguje offline.

> **Studijní nástroj.** Aplikace neslouží k výpočtu dávek reálným pacientům.

## Spuštění

```bash
pnpm install
pnpm dev        # https na 0.0.0.0, certifikát do ./certificates
```

`next dev --experimental-https` vygeneruje lokální certifikát a vypíše adresu
v LAN. Tu otevři na telefonu (iPhone v Safari, Android v Chromu) — bez
HTTPS by service worker ani „Přidat na plochu“ nefungovaly správně.

Service worker se registruje **jen v produkčním buildu**. Offline provoz
se proto testuje takto:

```bash
pnpm build      # next build (statický export do out/) + vygenerování out/sw.js
pnpm preview    # HTTPS server nad out/, používá stejný certifikát
```

## Účet a žebříček (nepovinné)

Aplikace funguje bez serveru. Přihlášení, přátelé a žebříček se zapnou, až
`.env.local` dostane údaje k Supabase — vzor je v `.env.example`. Schéma
a politiky jsou v `supabase/migrations`; přístup hlídá Row Level Security,
protože statický export nemá server, kam by se dala schovat kontrola práv.

## Skripty

| Skript | Co dělá |
|---|---|
| `pnpm dev` | Vývojový server, HTTPS, dostupný v LAN |
| `pnpm build` | Statický export do `out/` + service worker s precache manifestem |
| `pnpm preview` | Naservíruje `out/` přes HTTPS pro test na telefonu |
| `pnpm icons` | Přegeneruje ikony a startovací obrazovky z `brand/icon.svg` |
| `pnpm katex` | Přegeneruje `src/app/katex.css` a `public/fonts/katex` z balíčku katex |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |

## Struktura

```
brand/icon.svg          zdroj značky — výměna ikony = tenhle soubor + pnpm icons
messages/               překlady (cs, sk); v komponentách nesmí být natvrdo text
scripts/build-sw.mjs    sestaví out/sw.js z šablony a obsahu out/
scripts/sw.template.js  service worker — edituj tady, ne v out/
src/app/globals.css     designové tokeny (barvy, typografie, tvar, pohyb)
src/app/katex.css       generovaný soubor — needituj ručně, spusť `pnpm katex`
src/core/               výpočetní jádro: jednotky, vzorce, šablony, fond přípravků
src/components/exercise/  obrazovka příkladu, klávesnice, krokové řešení
src/components/ui/      odečty, stupnice, kruh cíle — stavebnice výrazu
src/i18n/               volba jazyka a katalogy zpráv
src/lib/db.ts           lokální databáze (Dexie); zdroj pravdy pro hraní
src/lib/sync.ts         odesílání fronty událostí na server
src/lib/stats.ts        statistika a výběr chyb k opakování
supabase/migrations/    schéma a politiky serverové vrstvy
src/lib/splashScreens.ts  generovaný soubor — needituj ručně
```

## Rozhodnutí, která je dobré znát

- **Statický export.** `output: "export"` drží aplikaci ve tvaru, který jde
  bez přepisování zabalit Capacitorem a celý přednačíst do service workeru.
- **Jazyk bez routingu.** Locale se drží v `localStorage` a přepíná na klientu,
  takže přepnutí funguje offline a existuje jediná `start_url`.
- **Červená je vyhrazená chybné odpovědi.** Správná odpověď se hlásí accentem.
- **Čísla jsou tabulární.** Šířka číslic se nesmí měnit.
- **Měřené hodnoty jsou strojopisem** (`.readout`). Rozdíl mezi „140“ v běžném
  řezu a v IBM Plex Mono je rozdíl mezi textem a displejem. Ve strojopisu má
  ale i desetinná čárka celou šířku znaku, takže oddělovač sází `<Numeral>`.
- **Stav hry žije v zařízení.** Aplikace funguje offline a bez účtu; server
  bude ve fázi 5 nadstavba, ne podmínka. Do fronty `outbox` se zapisuje, co se
  stalo, ne jaký je stav — dvě zařízení offline by se stavem přepsala.
- **Klávesnice je vlastní, ne systémová.** Systémová na iOS překryje spodní
  třetinu i s tlačítkem odpovědi a nabízí znaky, které v odpovědi nedávají smysl.
- **Ve výpočetním jádře není text v žádném jazyce.** Vzorce sázejí tokeny
  (`\text{@dose}`) a jazyk se doplní až ve vrstvě zobrazení; test to hlídá
  tím, že jádro smí vracet jen ASCII.
