# Zdroje faktických údajů

Každý faktický údaj v šablonách příkladů — síla přípravku, koncentrace,
velikost balení, dávkovací rozmezí, postup rekonstituce — pochází z některého
ze zdrojů níže. Žádné číslo není odhadnuté ani odvozené z paměti modelu.

Ověřeno: **2.–3. 9. 2026.** Podkladová data SÚKL: vydání **27. 8. 2026**.

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

Závazné mapování je v kódu: každá šablona nese pole `source` s citací,
kódem SÚKL a datem ověření a bez něj se nedostane do produkčního setu.
Tabulka níže je pohled z druhé strany — které dokumenty se používají
a co se z nich bere. Sloupec „SPC“ odkazuje na soubor v archivu SÚKL
`SPC20260827.zip`.

| Dokument | Přípravek | Kód SÚKL | Co se z něj bere | Kde |
|---|---|---|---|---|
| DLP | 614 registrovaných balení | — | název, síla, koncentrace, velikost balení | `products/pool.generated.ts` |
| SPC224021 | PARALEN 125 mg tablety | 0254422 | 10–15 mg/kg jednotlivě, max. 60 mg/kg/den | `products/dosing.ts` |
| SPC226792 | Ibalgin Baby 20 mg/ml susp. | 0254306 | 5–10 mg/kg, max. 40 mg/kg/den | `products/dosing.ts` |
| SPC215152 | Nurofen pro děti 20 mg/ml | 0237380 | 20–30 mg/kg/den ve 3–4 dávkách | `products/dosing.ts` |
| SPC197336 | Ospamox 250 mg/5 ml | 0066366 | 40–90 mg/kg/den ve 3 dávkách | `products/dosing.ts` |
| SPC234098 | Augmentin 400/57 mg/5 ml | 0285509 | 25–45 mg/kg/den ve 2 dávkách **a vzorec pro objem** | `products/dosing.ts`, `templates/K3` |
| SPC209840 | Gentamicin Lek 80 mg/2 ml | 0096414 | 3–6 mg/kg/den, max. 7,5 mg/kg/den | `products/dosing.ts` |
| SPC231903 | Vancomycin Kabi 1000 mg | 0156259 | 15–20 mg/kg à 8–12 h, max. 2 g; rekonstituce; **pásma clearance**; Cockcroft–Gaultův vzorec | `products/dosing.ts`, `reconstitution.ts`, `renal.ts` |
| SPC212156 | Ceftriaxon Kabi 1 g | 0121237 | 50–80 mg/kg 1× denně; 1 g + 10 ml → 100 mg/ml | `products/dosing.ts`, `reconstitution.ts` |
| SPC226307 | Meropenem AptaPharma 1 g | 0232677 | 10–40 mg/kg; konečná koncentrace 1–20 mg/ml | `products/dosing.ts`, `reconstitution.ts` |
| SPC205710 | CLEXANE 6 000 IU (60 mg)/0,6 ml | 0115402 | 100 IU/kg = 1 mg/kg à 12 h — dvojí značení | `products/dosing.ts` |
| SPC217219 | Adrenalin Léčiva 1 mg/ml | 0000362 | 0,01–0,03 mg/kg u novorozenců, max. 1 mg | `products/dosing.ts` |
| SPC236508 | Digoxin Léčiva 0,125 mg | 0083318 | 10–25 µg/kg/den udržovací, 10–50 µg/kg nárazová | `products/dosing.ts` |
| SPC191989 | Noradrenalin Léčiva 1 mg/ml | 0000536 | udržovací dávka 2–12 µg/min | `products/dosing.ts` |
| SPC219162 | Dobutamin hameln 5 mg/ml | 0252131 | 2–20 µg/kg/min | `products/dosing.ts` |
| SPC200355 | Paclitaxel Ebewe 6 mg/ml | 0104239 | 135–175 mg/m², koncentrace 6 mg/ml | `products/dosing.ts` |
| SPC212755 | Carboplatin Accord 10 mg/ml | 0241270 | 200–400 mg/m² podle clearance; **Calvertův vzorec a cílové AUC**; snížení úvodní dávky o 20–25 % | `products/dosing.ts`, `renal.ts`, `oncology.ts` |
| SPC202208 | Doxorubicin Ebewe 2 mg/ml | 0107681 | 60–75 mg/m² à 3 týdny; **kumulativní limit 550, resp. 400 mg/m²** | `products/dosing.ts` |
| SPC159050 | Ardeaelytosol conc. kaliumchlorid 7,45% | 0069737 | 74,5 g/l = K⁺ 1000 mmol/l; max. 20 mmol/h | `products/electrolytes.ts` |
| SPC189696 | Chlorid sodný B. Braun 5,85% | 0055913 | 58,5 mg/ml = Na⁺ 1 mol/l | `products/electrolytes.ts` |
| SPC216028 | Chlorid sodný B. Braun 0,9 % | 0047308 | 9 g/l = Na⁺ 154 mmol/l | `products/electrolytes.ts` |
| SPC191610 | Magnesium sulfate Kalceks | 0231541, 0231544 | 1 g heptahydrátu = 8,1 mEq = 4,1 mmol Mg²⁺ | `products/electrolytes.ts` |
| SPC123043, SPC123046 | Ardeanutrisol G 5–40 % | 0032348 … 0032360 | 50–400 g glukózy v litru | `products/solutions.ts` |
| SPC125966 | Heparin Léčiva 5000 IU/ml | 0091915 | 5 000 IU v 1 ml | fond, `templates/H3` |
| EMA EPAR | Actrapid | 0026481, 0026483 | registrace v koncentraci 40 i 100 IU/ml | fond, `templates/I2` |
| ISO 7886-1 | — | — | tolerance objemu odměřeného stříkačkou | `devices.ts` |
| IEC 60601-2-24 | — | — | přesnost průtoku pumpy ±2 % | `devices.ts` |
| B. Braun IV109 3/20 | — | — | kapkové faktory 10, 15, 20 a 60 gtt/ml | `devices.ts` |
| BIPM, SI | — | — | předpony jednotek | `templates/registry.ts` |

Publikované vzorce (Mosteller, Cockcroft–Gault, Calvert) se citují na
původní práci, viz oddíl 4. U Calverta a Cockcroft–Gaulta je vedle ní
uvedené i SPC, které tentýž vzorec přebírá — čísla dosazovaná do vzorce
(cílové AUC, pásma clearance) totiž pocházejí odtud, ne z původních prací.

## Šablony k doplnění zdroje

Tyto nesmí do produkčního setu, dokud nebudou podložené (`needsReview: true`):

- ~~F2, F3 — kapkové faktory~~ **doloženo** dokumentem B. Braun IV109 3/20,
  viz oddíl 5. Výrobce uvádí čtyři faktory: 10, 15, 20 a 60 gtt/ml.
- ~~L4 — kumulativní dávka antracyklinu~~ **doloženo** SPC doxorubicinu:
  celoživotní limit 550 mg/m², u pacienta po ozáření mediastina nebo se
  srdečním onemocněním 400 mg/m².
- **I3 — korekční faktor a poměr inzulin/sacharidy.** Pravidlo 100 uvádí
  konsenzuální doporučený postup ISPAD 2022 („The usual 100/TDD for mmol/l
  (or 1800 for mg/dL)“, Sundberg F, deBeaufort C, Krogvold L, et al.
  Pediatr Diabetes. 2022;23(8):1496–1511, doi:10.1111/pedi.13427). V SPC
  inzulinů pravidlo není a být nemůže — je to postup výpočtu dávky, ne údaj
  o přípravku.

  Zbývá rozhodnout, jestli doporučený postup odborné společnosti patří mezi
  přípustné zdroje; CLAUDE.md dnes uvádí SÚKL, ŠÚKL, SPC, AISLP a BNF.
  Do rozhodnutí zůstává I3 jediná šablona mimo produkční set.
