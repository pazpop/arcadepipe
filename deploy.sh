#!/usr/bin/env bash
# Déploie ArcadePipe (backend + frontend) sur le VPS.
# Remplace la séquence manuelle tar/scp/ssh du README (section VPS) — mêmes
# commandes, juste regroupées pour ne pas en oublier une pendant un vrai
# incident. Suppose que la stack Traefik (repo infra) tourne déjà.
#
# Usage : ./deploy.sh [IP] [--dry-run]
set -euo pipefail

# IP par défaut du VPS — en variable ici pour une éventuelle migration
# (changer une seule ligne plutôt que de fouiller le script).
DEFAULT_HOST="91.99.16.66"

DRY_RUN=false
HOST="$DEFAULT_HOST"
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) HOST="$arg" ;;
  esac
done

SSH_KEY="$HOME/.ssh/arcadepipe_vps"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAR_PATH="/tmp/arcadepipe-deploy.tar.gz"

# Exécute la commande normalement, ou l'affiche sans l'exécuter en --dry-run.
# Les commandes en lecture seule (docker compose config --images, docker
# image inspect) tournent quand même en dry-run : elles ne modifient rien et
# donnent un aperçu fidèle de ce qui serait fait.
run() {
  if $DRY_RUN; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

echo "== Déploiement d'ArcadePipe sur $HOST $($DRY_RUN && echo '(dry-run — rien ne sera modifié)') =="

run tar -czf "$TAR_PATH" -C "$SCRIPT_DIR" \
  --exclude='backend/venv' --exclude='backend/__pycache__' --exclude='backend/arcadepipe.db' \
  --exclude='backend/.pytest_cache' --exclude='backend/test_main.py' --exclude='backend/test_api.py' \
  --exclude='backend/requirements-dev.txt' --exclude='backend/pyproject.toml' \
  --exclude='frontend/js/*.test.js' --exclude='frontend/js/package.json' \
  backend frontend docker-compose.yml

run scp -i "$SSH_KEY" "$TAR_PATH" "root@$HOST:~/arcadepipe.tar.gz"
$DRY_RUN || rm -f "$TAR_PATH"

# rm avant extraction : tar écrase/ajoute mais ne supprime jamais les
# fichiers déjà présents sur la VPS qui n'existent plus en local (constaté
# avec chiptune2.js/libopenmpt.js, restés servis après leur suppression du
# repo) — sans ce nettoyage, backend/ et frontend/ accumulent indéfiniment
# des fichiers obsolètes au lieu d'être un vrai miroir.
run ssh -n -i "$SSH_KEY" "root@$HOST" "mkdir -p ~/arcadepipe && rm -rf ~/arcadepipe/backend ~/arcadepipe/frontend && tar xzf ~/arcadepipe.tar.gz -C ~/arcadepipe && rm ~/arcadepipe.tar.gz"

# Snapshot :previous des images CONSTRUITES localement (services avec
# "build:" dans docker-compose.yml), avant reconstruction — voir le
# commentaire équivalent dans terraform-infra-pazpop-hetzner/deploy.sh pour
# le pourquoi et la mise en garde sur `docker image prune -a`.
BUILT_SERVICES="$(awk '
  /^  [a-zA-Z0-9_-]+:$/ { svc=$1; sub(":$","",svc) }
  /^    build:/ { print svc }
' "$SCRIPT_DIR/docker-compose.yml" | sort -u | tr '\n' ' ')"

if [ -z "$BUILT_SERVICES" ]; then
  echo "-- Aucune image construite localement : snapshot :previous ignoré --"
else
  echo "-- Snapshot :previous ($BUILT_SERVICES) --"
  IMAGES="$(ssh -n -i "$SSH_KEY" "root@$HOST" "cd ~/arcadepipe && docker compose config --images $BUILT_SERVICES" 2>/dev/null || true)"
  for img in $IMAGES; do
    if ssh -n -i "$SSH_KEY" "root@$HOST" "docker image inspect '$img' >/dev/null 2>&1"; then
      base="${img%:*}"
      run ssh -n -i "$SSH_KEY" "root@$HOST" "docker tag '$img' '$base:previous'"
      echo "snapshot : $img -> $base:previous"
    fi
  done
fi

run ssh -n -i "$SSH_KEY" "root@$HOST" "cd ~/arcadepipe && docker compose up -d --build"

# Ne garder que le running (:latest) et le snapshot (:previous) — voir le
# commentaire équivalent dans terraform-infra-pazpop-hetzner/deploy.sh pour
# le détail (docker image prune -f, sans -a, ne touche jamais :latest ni
# :previous tant qu'ils restent tagués).
echo "-- Nettoyage des images orphelines --"
run ssh -n -i "$SSH_KEY" "root@$HOST" "docker image prune -f"

if $DRY_RUN; then
  echo
  echo "== Dry-run terminé : rien n'a été transféré, construit ou démarré =="
  exit 0
fi

# Attend que les conteneurs soient prêts (ni "starting" ni "unhealthy")
# plutôt qu'un délai fixe — un sleep trop court afficherait un faux ❌
# pendant qu'un conteneur est encore dans son start_period de healthcheck.
# 30s max, revérifié toutes les 2s.
ATTENTE=0
while [ "$ATTENTE" -lt 30 ]; do
  PAS_PRET="$(ssh -n -i "$SSH_KEY" "root@$HOST" "cd ~/arcadepipe && docker compose ps --format '{{.Status}}'" 2>/dev/null | grep -iE 'starting|unhealthy' || true)"
  [ -z "$PAS_PRET" ] && break
  sleep 2
  ATTENTE=$((ATTENTE + 2))
done

STATUT="$(ssh -n -i "$SSH_KEY" "root@$HOST" "cd ~/arcadepipe && docker compose ps --format 'table {{.Name}}\t{{.Status}}'")"
CODE_SITE="$(curl -sS -o /dev/null -w '%{http_code}' "https://arcadepipe.pazpop.net/" || echo '???')"
CODE_API="$(curl -sS -o /dev/null -w '%{http_code}' "https://arcadepipe.pazpop.net/api/health" || echo '???')"

ECHEC=false
[ -n "$PAS_PRET" ] && ECHEC=true
[ "$CODE_SITE" = "200" ] || ECHEC=true
[ "$CODE_API" = "200" ] || ECHEC=true

echo
echo "===================== Résumé ====================="
echo "$STATUT"
echo "----------------------------------------------------"
[ "$CODE_SITE" = "200" ] && echo "arcadepipe.pazpop.net      : ✅ $CODE_SITE" || echo "arcadepipe.pazpop.net      : ❌ $CODE_SITE"
[ "$CODE_API" = "200" ] && echo "arcadepipe.pazpop.net/api  : ✅ $CODE_API" || echo "arcadepipe.pazpop.net/api  : ❌ $CODE_API"
echo "===================================================="

$ECHEC && exit 1
exit 0
