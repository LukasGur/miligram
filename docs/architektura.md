# Architektura

Struktura repozitáře a rozhodnutí, která je dobré znát. Příkazy jsou v README.md.

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
