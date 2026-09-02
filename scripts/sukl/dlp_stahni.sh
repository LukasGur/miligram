#!/bin/zsh
# Stáhne a rozbalí aktuální vydání databáze léčivých přípravků.
set -e
cd "$(dirname "$0")"
VYDANI="${1:-20260827}"
mkdir -p data && cd data
curl -fLO "https://opendata.sukl.cz/soubory/SOD${VYDANI}/DLP${VYDANI}.zip"
unzip -o -q "DLP${VYDANI}.zip"
# Převod do UTF-8 jednou, ať s tím nemusí bojovat každý dotaz.
iconv -f CP1250 -t UTF-8 dlp_lecivepripravky.csv | tr -d '\r' > lp.utf8.csv
echo "hotovo: $(wc -l < lp.utf8.csv) záznamů v data/lp.utf8.csv"
