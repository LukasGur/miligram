# Miligram — poznámky pro práci na projektu

PWA pro trénink výpočtů dávkování léků (ČR/SK). Next.js App Router, statický
export, offline-first. Podrobnosti k příkazům a struktuře jsou v README.md.

## Pravidla, která platí bez výjimky

- **Žádný text natvrdo v komponentách.** Všechno přes `next-intl`
  (`messages/cs.json`, `messages/sk.json`) — včetně zadání příkladů
  a krokových řešení.
- **Faktické údaje o lécích se nevymýšlí.** Síly, koncentrace, balení
  a dávkovací rozmezí musí mít v kódu pole `source` a `verifiedAt`
  a pocházet ze SÚKL/ŠÚKL/SPC/AISLP/BNF. Nedohledané šablony se značí
  `needsReview: true` a do produkčního setu nepatří.
- **Červená (`--color-danger`) jen pro chybnou odpověď.** Nikdy dekorativně.
- **Tabulární číslice** všude, kde se hodnota mění (`.num`, `data-numeric`).
- **Sahatelné cíle ≥ 44 px**, primární akce ve spodní třetině obrazovky.
- Generovaný `src/lib/splashScreens.ts` se needituje ručně.

## Fáze

1. ✅ Základ — PWA, manifest, service worker, iOS onboarding, tokeny, i18n
2. Výpočetní jádro — šablony, generátor, unit testy (Vitest)
3. Design systém — klávesnice, obrazovka příkladu, moment vyhodnocení
4. Gamifikace lokálně — Dexie, prášky, série, XP, nápovědy, odbytek
5. Účet a sociální vrstva — Supabase, sync, přátelé, ligy, souboje
6. Lokalizace — dokončení SK
7. Statistiky a tréninkové režimy
8. Leštění — přístupnost, výkon, Lighthouse, test na iPhonu
