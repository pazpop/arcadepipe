# Pas de build step (vanilla JS) — juste servir les fichiers statiques avec
# Caddy. Caddyfile personnalisé (compression, route /api/*) plutôt que celui
# par défaut de l'image, vu la taille de lib/libopenmpt.worklet.js.
# Épinglé par digest (voir docs/deploiement.md) ; Dependabot propose les mises à jour.
FROM caddy:2-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b

# setcap donne au binaire caddy la capacité de se lier au port 80 (<1024)
# sans être root — indispensable puisqu'on abandonne root plus bas. libcap
# ne sert qu'au moment du build (fournit la commande `setcap`) ; le droit
# obtenu est porté par le binaire lui-même (xattr), pas par le paquet, donc
# `apk del libcap` ensuite ne le retire pas.
RUN apk add --no-cache libcap \
    && setcap cap_net_bind_service=+ep /usr/bin/caddy \
    && apk del libcap

COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html /usr/share/caddy/
COPY robots.txt /usr/share/caddy/
COPY favicon.svg /usr/share/caddy/
COPY css/ /usr/share/caddy/css/
COPY js/ /usr/share/caddy/js/
COPY lib/ /usr/share/caddy/lib/
COPY music/ /usr/share/caddy/music/

# Utilisateur dédié plutôt que root — même raisonnement que backend/Dockerfile :
# si Caddy est un jour compromis, l'attaquant hérite des droits de cet
# utilisateur, pas de root dans le conteneur. /config et /data (autosave de
# config, cache Caddy) sont montés en tmpfs par docker-compose.yml, pas
# besoin de les chown ici — Caddy ne sert que du HTTP, sans certificat.
RUN adduser -D -u 1000 caddyuser \
    && chown -R caddyuser:caddyuser /etc/caddy /usr/share/caddy
USER caddyuser

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --spider -q http://localhost:80/ || exit 1
