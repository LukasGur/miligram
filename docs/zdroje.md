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

`src/core/products/pool.generated.ts` obsahuje 619 registrovaných balení
vybraných z DLP. Generuje ho `scripts/sukl/build-pool.mjs`.

Dělba odpovědnosti: **faktické údaje** (síla, koncentrace, balení) pocházejí
z DLP a jsou dohledatelné podle kódu SÚKL. **Výběr účinných látek** je
kurátorské rozhodnutí a žije zvlášť v `scripts/sukl/latky-vyber.json`;
každý název se ověřuje proti číselníku ATC ze SÚKL a při neshodě build
skončí chybou, takže se do fondu nedostane vymyšlená látka.

### 7. Obvyklé dávky pro dospělé (základní úlohy)

`src/core/products/adultDoses.ts` — 45 přípravků, u každého kód SÚKL,
soubor SPC a doslovná pasáž z bodu 4.2. Ověřeno **24. 9. 2026**.

Základní úlohy (objem z ampule, počet ampulí, zbytek, zpětný výpočet)
dřív losovaly dávku jako násobek obsahu ampule a vycházely nereálné
ordinace (4,8 ampule ketaminu, 2 g zuklopenthixolu naráz). Teď smí zadat
jen dávku, kterou SPC u dospělého uvádí nebo která leží v citovaném
rozmezí. Citace SPC se u příkladu zobrazuje spolu s ostatními zdroji.

Záměrně vynechané: přípravky dávkované jen podle hmotnosti nebo povrchu
těla (cytostatika, aminoglykosidy, myorelaxancia), Paracetamol Kabi 10 ml
(ampule je podle SPC pro děti do 33 kg), Rivotril 1 mg/ml (ředí se
rozpouštědlem) a Solu-Medrol (lyofilizát, objem z DLP nevyčteme).

**5. 10. 2026** přibylo 52 přípravků (soubory SPC a citace jsou v kódu):
40 tablet a tobolek, 2 perorální roztoky a 10 prášků k rekonstituci.
U tablet je navíc četnost podání a délka léčby z téže citace (úloha
na počet balení), a kde to bod 3 SPC výslovně připouští, i to, že tabletu
lze rozdělit na stejné dávky. Půlicí rýha „pro snazší polykání“ nestačí.
U prášků je dávka z bodu 4.2 a tam, kde bod 6.6 uvádí objem i výslednou
koncentraci, i objem rozpouštědla.

Proč: počet tablet, objem perorálního roztoku, počet lahviček a balení
na kúru se dřív losovaly jako násobky síly. Vycházelo 180 mg gliklazidu
(nejvýš 120 mg denně), 2× 300 mg klopidogrelu třikrát denně po 60 dní
nebo 7,5 g metamizolu z kapek. Teď A1, A2, A5, A7, E1 a E5 zadávají
jen dávky z tabulky.

Ředění (D1, D2, D4, D6) a infuze (F1–F6) dávku netvrdí, a tak tabulku
nepotřebují. Drží se toho, co je v balení podle DLP: natahuje se nejvýš
obsah balení, pacient dostane nejvýš obsah vaku, rychlosti se počítají
jen u nosných roztoků. Perfuzor (G1–G6) má dávku jen z rozmezí látky,
o kterou jde — dopamin podle SPC Tensaminu (SPC163908), noradrenalin
podle SPC191989.

Fond také vylučuje přípravky jen s cestou podání IPT, ITH nebo ICM
a rozlišuje typ obalu (lahvička, pero, zásobní vložka, předplněná
stříkačka) — viz `scripts/sukl/README.md`.

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
| DLP | 619 registrovaných balení | — | název, síla, koncentrace, velikost balení | `products/pool.generated.ts` |
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
| SPC163908 | Tensamin 40 mg/ml | 0004380 | 2–5 µg/kg/min „velmi malé dávky“, do 50 µg/kg/min β-mimetický účinek; úlohy berou 2–20 | `products/dosing.ts`, `templates/perfusor.ts` |
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
| 45 × SPC, bod 4.2 | ampule a perorální roztoky ve fondu | viz soubor | obvyklé jednotlivé dávky pro dospělého — ordinace v A3, A4, A6, A8 | `products/adultDoses.ts` |
| SPC233233, SPC154505/8, SPC221075/8, SPC228375/7, SPC212156 | AZEPO, Ampicilin BBP, Fortum, AXETINE, Ceftriaxon Kabi | viz soubor | objem roztoku po rozpuštění, nebo přibližná koncentrace — kolik místa zabere prášek (E4) | `products/powderVolumes.ts` |
| 52 × SPC, body 3, 4.2 a 6.6 | tablety, perorální roztoky, prášky ve fondu | viz soubor | dávka, četnost, délka léčby, dělitelnost, rozpouštědlo — A1, A2, A5, A7, E1, E5 | `products/adultDoses.ts` |
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
- ~~I3 — korekční faktor~~ **doloženo** konsenzuálním doporučeným postupem
  ISPAD 2022: „The usual 100/TDD for mmol/l (or 1800 for mg/dL) often needs
  to be adjusted…“ (Sundberg F, deBeaufort C, Krogvold L, et al. ISPAD
  Clinical Practice Consensus Guidelines 2022: Managing diabetes in
  preschoolers. Pediatr Diabetes. 2022;23(8):1496–1511,
  doi:10.1111/pedi.13427). V SPC inzulinů pravidlo není a být nemůže — je
  to postup výpočtu dávky, ne údaj o přípravku. CLAUDE.md proto od 18. 9.
  2026 připouští i doporučené postupy odborných společností.

  Český doporučený postup (Prázný M, Rušavý Z, Šumník Z, et al. Použití
  inzulinové pumpy a glukózových senzorů u pacientů s diabetem léčených
  inzulinem. DMEV. 2019;22(4):152–169) pravidlo 100 neuvádí vůbec: žádá,
  aby korekční bolus určil lékař individuálně, a plošné užívání bolusových
  kalkulátorů mimo pumpy a certifikovaná zařízení nedoporučuje. Proto je
  v šabloně i v citaci napsané, že jde o odhad pro začátek. Cvičí se
  výpočet, ne ordinace.

  Všech 72 šablon je tím v produkčním setu.

## Pořadí učiva v programu

Osm stupňů kopíruje praktická cvičení Ústavu farmakologie LF UP
v Olomouci — dávkování se tam neučí jako samostatný předmět, je rozeseté
v cvičeních z preskripce a z jednotlivých skupin léčiv.

- **Farmakologie 1** (FAR/VCB11, 3. ročník): tekuté lékové formy (cv. 2),
  dávkování léků v dětském věku (cv. 4), parenterální léky (cv. 5),
  farmakokinetika a terapeutické monitorování léčiv (cv. 7).
- **Farmakologie 2** (FAR/VCA13, 4. ročník): kardiovaskulární léky
  (cv. 2–3), antibiotika včetně glykopeptidů (cv. 7–8), změny
  farmakokinetiky u dětí, starých a v graviditě (cv. 12), hormony
  (cv. 13). Přednášky: diabetes (11), onkologie (13), akutní život
  ohrožující stavy (14).

Sylaby: <https://www.lf.upol.cz/ustavy-a-kliniky/ustavy/ustav-farmakologie/>

## Ikony

Kresby ikon pocházejí z knihovny **Lucide** (<https://lucide.dev>, licence
ISC) a jsou opsané do `src/components/icons.tsx`
a `src/components/ui/CategoryIcon.tsx`. Závislost se nepřidává schválně:
do balíku by se dostalo i to, co se nepoužívá, a domovská obrazovka má
na kilobajty nárok.

Dvě ikony Lucide nemá a jsou dokreslené na téže mřížce (24×24, tah 2,
kulaté konce), aby v sadě nevyčnívaly: **ledvina** pro renální dávkování
a **sdílení na iOS**, kde musí symbol sedět s tím, co ukazuje systém.

Zvažovaly se i **Healthicons** (<https://healthicons.org>, MIT/CC0) —
mají bohatší zdravotnickou slovní zásobu včetně ledviny, ale kreslí plné
siluety na mřížce 48×48. Vedle tahových ikon by to byly dva různé sety.
