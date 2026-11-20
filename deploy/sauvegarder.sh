#!/bin/sh
# Sauvegarde quotidienne de la base du site en ligne (#184).
# À lancer depuis le dossier deploy/ de la machine, par cron, une fois par jour :
#
#   15 3 * * * cd /home/<utilisateur>/crimetracker/deploy && ./sauvegarder.sh >> sauvegardes/journal.txt 2>&1
#
# Chaque sauvegarde est un fichier compressé daté dans sauvegardes/; les 14 plus récentes sont gardées.
# Les photos et pièces jointes (volume crimetracker-uploads) sont copiées à côté, une fois par jour aussi.
set -eu

DOSSIER=${DOSSIER:-sauvegardes}
GARDER=${GARDER:-14}
DATE=$(date +%Y-%m-%d_%H%M)

mkdir -p "$DOSSIER"

# Base : pg_dump dans le conteneur postgres (format personnalisé, restaurable avec pg_restore)
docker compose exec -T postgres pg_dump -U crimetracker -d crimetracker --format=custom \
  > "$DOSSIER/base_$DATE.dump.tmp"
mv "$DOSSIER/base_$DATE.dump.tmp" "$DOSSIER/base_$DATE.dump"

# Fichiers envoyés par les agents (photos de profil, pièces jointes)
docker compose exec -T api tar -czf - -C /app/serveur/src uploads > "$DOSSIER/fichiers_$DATE.tar.gz.tmp"
mv "$DOSSIER/fichiers_$DATE.tar.gz.tmp" "$DOSSIER/fichiers_$DATE.tar.gz"

# Ne garder que les plus récentes
for motif in 'base_*.dump' 'fichiers_*.tar.gz'; do
  ls -1t "$DOSSIER"/$motif 2>/dev/null | tail -n +$((GARDER + 1)) | xargs -r rm -f
done

echo "$(date -Iseconds) sauvegarde faite : base_$DATE.dump ($(du -h "$DOSSIER/base_$DATE.dump" | cut -f1))"
