# Nástroje pro ověřování údajů ze SÚKL

Slouží k dohledání faktických údajů o léčivých přípravcích a k jejich
opakovanému ověření proti novějšímu vydání dat. Nejsou součástí buildu
aplikace — spouštějí se ručně při přípravě nebo revizi šablon.

Pravidlo, které tyhle skripty vynucují: **žádný faktický údaj v šabloně
nesmí vzniknout jinak než výpisem z těchto zdrojů.**

## Příprava

```bash
python3 -m venv .venv
.venv/bin/pip install pypdf
```

## 1. Databáze léčivých přípravků (DLP)

```bash
./dlp_stahni.sh          # stáhne a rozbalí aktuální vydání do data/
./dlp_najdi.sh PARALEN   # vypíše registrovaná balení
```

Výstup: `kód SÚKL | název | síla | forma | balení | ATC`.
Vypisují se **jen** položky se stavem registrace `R`.

## 2. Souhrny údajů o přípravku (SPC)

Archiv SPC má přes 2,5 GB, takže se nestahuje celý. `spc_stahni.py`
přečte přes HTTP Range centrální adresář ZIPu a vytáhne z něj jen
požadované soubory.

```bash
# vazba kód SÚKL → soubor SPC
grep "^0000536;" data/dlp_nazvydokumentu.csv | iconv -f CP1250 -t UTF-8

python3 spc_stahni.py SPC191989.pdf              # uloží do spc/
.venv/bin/python spc_davkovani.py SPC191989.pdf  # řádky s dávkovacími čísly
.venv/bin/python spc_oddil.py SPC191989.pdf      # celý oddíl 6.6 (rekonstituce)
```

`spc_oddil.py` bere oddíl z proměnných prostředí, takže jde vypsat kterýkoli:

```bash
START='4\.\s*2\.?\s*Dávkování' END='4\.\s*3' .venv/bin/python spc_oddil.py SPC191989.pdf
START='2\.\s*KVALITATIVNÍ' END='3\.\s*LÉKOVÁ' .venv/bin/python spc_oddil.py SPC159050.pdf
```

## Poznámky

- CSV soubory jsou v kódování **Windows-1250**, oddělovač `;`, konce řádků CRLF.
- Adresa archivu obsahuje datum vydání (`SOD20260827`). Při aktualizaci ji
  změň v `spc_stahni.py` i v `dlp_stahni.sh` a smaž `spc_index.json`.
- U centralizovaně registrovaných přípravků sloupec SPC neobsahuje soubor,
  ale odkaz na EMA. To je v pořádku — EMA je rovnocenný zdroj.
- Stažená data se necommitují, viz `.gitignore` v tomto adresáři.
