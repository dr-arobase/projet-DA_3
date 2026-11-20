#!/bin/sh
# Prouve qu'une sauvegarde se restaure (#184), sans toucher à la vraie base :
# la sauvegarde est chargée dans une base d'essai temporaire, on compte les lignes, puis on l'efface.
#
#   cd deploy && ./verifier-restauration.sh                       (la plus récente)
#   cd deploy && ./verifier-restauration.sh sauvegardes/base_2026-11-20_0315.dump
set -eu

FICHIER=${1:-$(ls -1t sauvegardes/base_*.dump | head -n 1)}
ESSAI=crimetracker_essai_restauration
PSQL="docker compose exec -T postgres psql -U crimetracker -v ON_ERROR_STOP=1"

echo "Sauvegarde essayée : $FICHIER"
$PSQL -d postgres -c "DROP DATABASE IF EXISTS $ESSAI" -c "CREATE DATABASE $ESSAI" > /dev/null
docker compose exec -T postgres pg_restore -U crimetracker -d "$ESSAI" --no-owner < "$FICHIER"

$PSQL -d "$ESSAI" -At -c "
  SELECT 'comptes      : ' || count(*) FROM app_user
  UNION ALL SELECT 'dossiers     : ' || count(*) FROM criminal
  UNION ALL SELECT 'signalements : ' || count(*) FROM sighting
  UNION ALL SELECT 'diffusions   : ' || count(*) FROM alert"

$PSQL -d postgres -c "DROP DATABASE $ESSAI" > /dev/null
echo "Restauration réussie; la base d'essai est effacée. Noter le résultat dans #184."
