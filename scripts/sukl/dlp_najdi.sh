#!/bin/zsh
# Vyhledá registrované přípravky podle názvu, volitelně filtruje ATC skupinou.
#   ./dlp_najdi.sh NORADRENALIN
#   ./dlp_najdi.sh CEFTRIAXON J01
cd "$(dirname "$0")"
if [[ ! -f data/lp.utf8.csv ]]; then
  echo "Chybí data/lp.utf8.csv — spusť nejdřív ./dlp_stahni.sh" >&2
  exit 1
fi
awk -F';' -v n="$1" -v a="${2:-}" \
  'NR>1 && $14=="R" && toupper($3) ~ toupper(n) && (a=="" || $19 ~ a) {
     printf "%-9s %-42s %-24s %-14s %-10s %s\n", $1, $3, $4, $5, $6, $19
   }' data/lp.utf8.csv | sort -k2,2 -k3,3 -u
