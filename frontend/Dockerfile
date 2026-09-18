# Pas de build step (vanilla JS) — juste servir les fichiers statiques.
# On utilise Caddy ici aussi (pas nginx) pour rester sur un seul type
# d'image entre ce conteneur et le reverse proxy de l'étape 4. Caddyfile
# personnalisé (compression) plutôt que celui par défaut de l'image, vu la
# taille de lib/libopenmpt.worklet.js.
# Épinglé par digest (pas juste par tag) : "2-alpine" est un tag flottant —
# même raisonnement que backend/Dockerfile. Dependabot (écosystème "docker")
# ouvre une PR à chaque nouveau digest disponible pour ce tag.
FROM caddy:2-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648

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
# besoin de les chown ici — Caddy ne s'en sert pas pour de vrais certificats
# (Traefik termine le TLS, ce Caddyfile ne sert que du HTTP statique).
RUN adduser -D -u 1000 caddyuser \
    && chown -R caddyuser:caddyuser /etc/caddy /usr/share/caddy
USER caddyuser

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --spider -q http://localhost:80/ || exit 1
