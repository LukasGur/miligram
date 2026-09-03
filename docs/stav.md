# Kde jsme

Poslední aktualizace: **3. 9. 2026**

## Hotovo

**Fáze 1** — PWA kostra. Statický export, vlastní service worker s precache
manifestem, iOS instalační lišta, designové tokeny, next-intl. Ověřeno
offline v Chromiu i vizuálně ve WebKitu.

**Fáze 2, jádro** — `src/core`: jednotky, vzorce, tolerance odvozená z norem
prostředků, deterministický generátor, fond 614 přípravků ze SÚKL,
tabulky dávkovacích rozmezí, rekonstituce a elektrolytů opsané ze SPC.

**Fáze 2, šablony** — hotovo **47 ze 72**. Testů prochází 195.

| Kategorie | Hotovo | Zbývá |
|---|---|---|
| A základní dávkování | A1–A8 | — |
| B podle hmotnosti | B1–B8 | — |
| C povrch těla | C1–C5 | — |
| D ředění | D1–D8 | — |
| E rekonstituce | E1–E5 | — |
| F rychlost infuze | F1–F6 | — |
| G vazoaktivní | G1–G7 | — |
| H převody jednotek | — | **H1–H6** |
| I inzulin | — | **I1–I4** (I3 bez zdroje, `needsReview`) |
| J renální dávkování | — | **J1–J5** |
| K pediatrie | — | **K1–K6** |
| L onkologie | — | **L1–L4** |

## Co dělat dál

1. **Dopsat 25 šablon** kategorií H, I, J, K, L. Vzor je kterákoli hotová
   šablona; postup je vždy stejný: `generate` losuje zadání z fondu nebo
   z ověřeného pravidla, `solve` vrací hodnotu a kroky řešení, `answer`
   určuje jednotku a toleranci. Rozsah a záměr každé zbývající šablony je
   popsaný ve schvalovacím podkladu (odkaz níže).
2. **Lokalizované texty** — zadání a popisy kroků zatím neexistují. Šablony
   vracejí jen klíče (`zadani`, `vzorec`, `dosazeni`, `vysledek`, …).
   Chybí `messages/cs.json` a `sk.json` pro sekci `exercise`.
3. **L4** (kumulativní dávka antracyklinu) potřebuje ověřit limit v SPC
   doxorubicinu — zatím není nikde tvrzený.
4. **I3** (korekční faktor inzulinu) čeká na zdroj, jinak vypustit.

## Rozhodnutí, která už padla

- Prášky jsou měna, XP je neutratitelné skóre. Zisk XP: 10 za správný
  příklad, +20 za bezchybnou lekci. Lekce má 7 příkladů.
- Tolerance se odvozuje z přesnosti prostředku (ISO 7886-1, IEC 60601-2-24,
  kapkové faktory B. Braun). Je to návrhové rozhodnutí, ne fakt ze zdroje.
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
pnpm test        # 195 testů výpočetního jádra
pnpm typecheck
pnpm lint
pnpm dev         # https, LAN, pro test na iPhonu
pnpm build && pnpm preview   # produkční build + offline test
```
