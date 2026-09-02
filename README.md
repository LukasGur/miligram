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
v LAN. Tu otevři na iPhonu v Safari — bez HTTPS by service worker ani
„Přidat na plochu“ nefungovaly správně.

Service worker se registruje **jen v produkčním buildu**. Offline provoz
se proto testuje takto:

```bash
pnpm build      # next build (statický export do out/) + vygenerování out/sw.js
pnpm preview    # HTTPS server nad out/, používá stejný certifikát
```

## Skripty

| Skript | Co dělá |
|---|---|
| `pnpm dev` | Vývojový server, HTTPS, dostupný v LAN |
| `pnpm build` | Statický export do `out/` + service worker s precache manifestem |
| `pnpm preview` | Naservíruje `out/` přes HTTPS pro test na telefonu |
| `pnpm icons` | Přegeneruje ikony a startovací obrazovky z `brand/icon.svg` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |

## Struktura

```
brand/icon.svg          zdroj značky — výměna ikony = tenhle soubor + pnpm icons
messages/               překlady (cs, sk); v komponentách nesmí být natvrdo text
scripts/build-sw.mjs    sestaví out/sw.js z šablony a obsahu out/
scripts/sw.template.js  service worker — edituj tady, ne v out/
src/app/globals.css     designové tokeny (barvy, typografie, tvar, pohyb)
src/i18n/               volba jazyka a katalogy zpráv
src/lib/splashScreens.ts  generovaný soubor — needituj ručně
```

## Rozhodnutí, která je dobré znát

- **Statický export.** `output: "export"` drží aplikaci ve tvaru, který jde
  bez přepisování zabalit Capacitorem a celý přednačíst do service workeru.
- **Jazyk bez routingu.** Locale se drží v `localStorage` a přepíná na klientu,
  takže přepnutí funguje offline a existuje jediná `start_url`.
- **Červená je vyhrazená chybné odpovědi.** Správná odpověď se hlásí accentem.
- **Čísla jsou tabulární.** Šířka číslic se nesmí měnit.
