# Zdroje faktických údajů

Každý faktický údaj v šablonách příkladů — síla přípravku, koncentrace,
velikost balení, dávkovací rozmezí, postup rekonstituce — pochází z některého
ze zdrojů níže. Žádné číslo není odhadnuté ani odvozené z paměti modelu.

Ověřeno: **2. 9. 2026.** Podkladová data SÚKL: vydání **27. 8. 2026**.

## Primární zdroje

### 1. SÚKL — Databáze léčivých přípravků (DLP)

Otevřená data Státního ústavu pro kontrolu léčiv, měsíční aktualizace.

- Katalog: <https://opendata.sukl.cz/?q=katalog/databaze-lecivych-pripravku-dlp>
- Použité vydání: `SOD20260827/DLP20260827.zip`, soubor `dlp_lecivepripravky.csv`
- Rozsah: 69 760 záznamů; použity **výhradně** položky se stavem registrace
  `REG = R` (registrovaný léčivý přípravek)

Odtud pochází: obchodní název, síla, léková forma, velikost balení, kód SÚKL,
ATC skupina.

### 2. SÚKL — Souhrny údajů o přípravku (SPC)

- Katalog: <https://opendata.sukl.cz/?q=katalog/spc-souhrn-udaju-o-lecivem-pripravku-summary-product-characteristics>
- Použité vydání: `SOD20260827/SPC20260827.zip`
- Vazba kód SÚKL → soubor SPC podle `dlp_nazvydokumentu.csv`

Odtud pochází: dávkovací rozmezí (bod 4.2), kvalitativní a kvantitativní
složení (bod 2), pokyny k rekonstituci a ředění (bod 6.6).

### 3. EMA — centralizovaně registrované přípravky

U přípravků s centralizovanou registrací SÚKL neuvádí vlastní SPC a odkazuje
na EMA. Týká se přípravku Actrapid.

- <https://www.ema.europa.eu/cs/documents/product-information/actrapid-epar-product-information_cs.pdf>

### 4. Publikované vzorce

Vzorce nejsou majetkem žádného přípravku a citují se přímo na původní práci.

| Vzorec | Zdroj |
|---|---|
| Mostellerův vzorec pro BSA | Mosteller RD. *Simplified calculation of body-surface area.* N Engl J Med 1987;317(17):1098 |
| Cockcroft–Gaultův vzorec | Cockcroft DW, Gault MH. *Prediction of creatinine clearance from serum creatinine.* Nephron 1976;16(1):31–41 |
| Calvertův vzorec | Calvert AH et al. *Carboplatin dosage: prospective evaluation of a simple formula based on renal function.* J Clin Oncol 1989;7(11):1748–56 — uvedený rovněž v SPC přípravku Carboplatin Accord |

### 5. Specifikace zdravotnických prostředků

Kapkový faktor, přesnost stříkačky a krok pumpy nejsou vlastnosti léku,
takže v SPC ani v DLP nejsou. Pocházejí z norem a z podkladů výrobců.

| Údaj | Zdroj |
|---|---|
| Kapkové faktory 10, 15, 20 a 60 gtt/ml | B. Braun Medical Inc., *Gravity Flow Rate Drip Chart*, dokument IV109 3/20 — <https://www.ismp.org/sites/default/files/attachments/2020-04/BBraun-flow-rate-drip-chart-04-03-2020.pdf> |
| Tolerance odměřeného objemu stříkačkou | ČSN EN ISO 7886-1, *Sterilní injekční stříkačky pro jedno použití* — <https://www.iso.org/standard/14835.html> |
| Krok nastavení a přesnost průtoku pumpy | B. Braun Perfusor Space, technické údaje; přesnost ±2 % podle IEC/EN 60601-2-24 — <https://www.bbraun.com/en/products/b/perfusor-space.html> |

Poznámka k tomu, co je doložené a co ne: **normy popisují přesnost
prostředku, ne požadovanou přesnost výpočtu.** Rozhodnutí odvodit z nich
toleranci odpovědi je návrhové — nemá smysl vymáhat po uživateli víc
přesnosti, než kolik jí umí doručit stříkačka nebo pumpa. Čísla jsou
doložená, ta úvaha je naše. Viz `src/core/tolerances.ts`.

Kapkový graf výrobce zároveň slouží jako referenční sada pro testy vzorce
(`src/core/__tests__/devices.test.ts`). Při přesné polovině zaokrouhluje
výrobce dolů (250 ml/h při 15 gtt/ml uvádí jako 62, ačkoli přesná hodnota
je 62,5), zatímco 18,75 uvádí jako 19. To je jeho volba pro remízu, ne
norma; aplikace proto u kapek přijímá zaokrouhlení oběma směry.

### 6. Fond přípravků

`src/core/products/pool.generated.ts` obsahuje 614 registrovaných balení
vybraných z DLP. Generuje ho `scripts/sukl/build-pool.mjs`.

Dělba odpovědnosti: **faktické údaje** (síla, koncentrace, balení) pocházejí
z DLP a jsou dohledatelné podle kódu SÚKL. **Výběr účinných látek** je
kurátorské rozhodnutí a žije zvlášť v `scripts/sukl/latky-vyber.json`;
každý název se ověřuje proti číselníku ATC ze SÚKL a při neshodě build
skončí chybou, takže se do fondu nedostane vymyšlená látka.

## Co se nepoužívá

Blogy, kvízové weby, studentská fóra, výstupy jazykových modelů, neověřená PDF.
Zadání příkladů jsou formulovaná vlastními slovy; ze zdrojů se přebírají pouze
faktické údaje, které nejsou předmětem autorského práva.

## Mapování šablon na zdroje

Sloupec „SPC“ odkazuje na soubor v archivu SÚKL `SPC20260827.zip`.
Kód SÚKL jednoznačně identifikuje konkrétní registrované balení.

| Šablona | Přípravek | Kód SÚKL | SPC | Co se z něj bere |
|---|---|---|---|---|
| A1 | PARALEN 500 mg tablety | 0254045 | SPC224025 | síla, jednotlivá dávka 500–1000 mg, max. 4 g/den |
| A2 | Ibalgin Baby 20 mg/ml perorální suspenze | 0254306 | SPC226792 | koncentrace 20 mg/ml, dávka 5–10 mg/kg |
| A3 | Furosemid Kabi 20 mg/2 ml inj./inf. roztok | 0116440 | SPC200743 | síla ampule 20 mg/2 ml |
| A4 | Gentamicin Lek 80 mg/2 ml inj./inf. roztok | 0096414 | SPC209840 | síla ampule, dávka 3–6 mg/kg/den |
| A5 | Digoxin Léčiva 0,125 mg tablety | 0083318 | SPC236508 | síla tablety, udržovací dávka 10–25 µg/kg/den |
| B1 | PARALEN 125 mg tablety | 0254422 | SPC224021 | 10–15 mg/kg jednotlivě, max. 60 mg/kg/den |
| B2 | Ospamox 250 mg/5 ml prášek pro susp. | 0066366 | SPC197336 | koncentrace, 40–90 mg/kg/den ve 3 dávkách |
| B3 | Ibalgin Baby 20 mg/ml | 0254306 | SPC226792 | max. denní dávka 40 mg/kg |
| B4 | CLEXANE 6 000 IU (60 mg)/0,6 ml | 0115402 | SPC205710 | 100 IU/kg = 1 mg/kg à 12 h, obsah stříkačky |
| B5 | Vancomycin Kabi 1000 mg | 0156259 | SPC231903 | 15–20 mg/kg à 8–12 h, max. 2 g na dávku |
| C1 | — (vzorec) | — | — | Mosteller 1987 |
| C2 | Paclitaxel Ebewe 6 mg/ml | 0104239 | SPC200355 | 175 mg/m², koncentrace 6 mg/ml |
| C3 | Paclitaxel Ebewe 6 mg/ml | 0104239 | SPC200355 | totéž + velikost balení |
| D1 | Glukóza B. Braun 40% | 0207769 | SPC209215 | 400 mg/ml |
| D2 | Chlorid sodný B.Braun 0,9% | 0047305 | SPC216028 | 9 mg/ml |
| D3 | Adrenalin Léčiva 1 mg/ml | 0000362 | SPC217219 | roztok 1:1000 = 1 mg/ml, dávky v mg/kg |
| D4 | Adrenalin Léčiva 1 mg/ml | 0000362 | SPC217219 | ředění 5 ml do 500 ml = 1:100 000 |
| D5 | Ardeaelytosol conc. kaliumchlorid 7,45% | 0069737 | SPC159050 | 74,5 g/l = K⁺ 1000 mmol/l, max. 20 mmol/h |
| E1 | Ceftriaxon Kabi 1 g | 0121237 | SPC212156 | 1 g + 10 ml VPI → 100 mg/ml |
| E2 | Vancomycin Kabi 1000 mg | 0156259 | SPC231903 | 1000 mg + 20 ml → 50 mg/ml; dále na ≤ 5 mg/ml |
| E3 | Meropenem AptaPharma 1000 mg | 0232677 | SPC226307 | konečná koncentrace 1–20 mg/ml |
| F1 | Chlorid sodný B.Braun 0,9% | 0047305 | SPC216028 | velikost vaku |
| F2 | — (kapkový faktor 20 gtt/ml) | — | — | **chybí ověřený zdroj** |
| F3 | — (kapkový faktor 60 gtt/ml) | — | — | **chybí ověřený zdroj** |
| F4 | Chlorid sodný B.Braun 0,9% | 0047305 | SPC216028 | velikost vaku |
| G1 | Noradrenalin Léčiva 1 mg/ml | 0000536 | SPC191989 | 1 mg/ml, dávka 2–12 µg/min, až 30 µg/min |
| G2 | Dobutamin hameln 5 mg/ml | 0252131 | SPC219162 | 250 mg/50 ml, ředění na 0,5 mg/ml, 2–20 µg/kg/min |
| G3 | Dobutamin hameln 5 mg/ml | 0252131 | SPC219162 | totéž, zpětný převod |
| G4 | Noradrenalin Léčiva 1 mg/ml | 0000536 | SPC191989 | obsah ampule 1 mg/1 ml |
| H1 | — (převod g/mg/µg) | — | — | soustava SI |
| H2 | Ardeaelytosol conc. kaliumchlorid 7,45% | 0069737 | SPC159050 | 1 ml = 1 mmol K⁺ |
| H3 | Heparin Léčiva 5000 IU/ml | 0091915 | SPC125966 | 5000 IU/ml, dávky v IU |
| H4 | CLEXANE | 0115402 | SPC205710 | 100 IU = 1 mg enoxaparinu |
| I1 | HUMULIN R 100 IU/ml | 0214355 | SPC162081 | 100 IU/ml |
| I2 | ACTRAPID 40 IU/ml | 0026481 | EMA EPAR | 40 IU/ml |
| I3 | — (korekční faktor, poměr I:S) | — | — | **chybí ověřený zdroj** |
| J1 | — (vzorec) | — | — | Cockcroft & Gault 1976 |
| J2 | Vancomycin Kabi | 0156259 | SPC231903 | úprava dávky podle CrCl (tabulka v bodě 4.2) |
| J3 | Carboplatin Accord 10 mg/ml | 0241270 | SPC212755 | dávka podle CrCl (250 mg/m² při 41–59 ml/min) |
| K1 | Nurofen pro děti 20 mg/ml | 0237380 | SPC215152 | 20–30 mg/kg/den ve 3–4 dávkách |
| K2 | Nurofen pro děti 20 mg/ml | 0237380 | SPC215152 | limit 25 ml u dětí pod 30 kg |
| K3 | Augmentin 400 mg/5 ml + 57 mg/5 ml | 0285509 | SPC234098 | vzorec pro objem uvedený přímo v SPC |
| L1 | Carboplatin Accord 10 mg/ml | 0241270 | SPC212755 | Calvertův vzorec, cílová AUC 4–7 |
| L2 | Carboplatin Accord 10 mg/ml | 0241270 | SPC212755 | totéž + koncentrace 10 mg/ml |

## Šablony k doplnění zdroje

Tyto nesmí do produkčního setu, dokud nebudou podložené (`needsReview: true`):

- ~~F2, F3 — kapkové faktory~~ **doloženo** dokumentem B. Braun IV109 3/20,
  viz oddíl 5. Výrobce uvádí čtyři faktory: 10, 15, 20 a 60 gtt/ml.
- **I3 — korekční faktor a poměr inzulin/sacharidy.** Pravidla 100 a 500
  nejsou v SPC inzulinů; jde o klinickou praxi. Potřebuje doporučený postup
  odborné společnosti nebo BNF.
