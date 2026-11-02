# Pas de build step (vanilla JS) : fichiers statiques servis par Caddy, avec un
# Caddyfile personnalisé (compression, route /api/*).
# Épinglé par digest (voir docs/deploiement.md) ; Dependabot propose les mises à jour.
FROM mirror.gcr.io/library/caddy:2-alpine@sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f

COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html privacy.html site-config.json /usr/share/caddy/
COPY robots.txt /usr/share/caddy/
COPY favicon.svg og-image.png /usr/share/caddy/
COPY css/ /usr/share/caddy/css/
COPY js/ /usr/share/caddy/js/
COPY lib/ /usr/share/caddy/lib/
COPY music/ /usr/share/caddy/music/
COPY press/ /usr/share/caddy/press/

# Numéro de version affiché dans le jeu : calculé par la CI (nombre de commits,
# voir .github/workflows/image.yml). Sans lui, le jeu affiche "dev". Le grep
# fait échouer la construction si la ligne VERSION de config.js n'a pas été trouvée.
ARG APP_VERSION=""
RUN if [ -n "$APP_VERSION" ]; then \
      sed -i "s/^export const VERSION = .*/export const VERSION = \"$APP_VERSION\";/" /usr/share/caddy/js/config.js \
      && grep -q "^export const VERSION = \"$APP_VERSION\";" /usr/share/caddy/js/config.js; \
    fi

# Utilisateur dédié plutôt que root — même raisonnement que backend/Dockerfile :
# si Caddy est un jour compromis, l'attaquant hérite des droits de cet
# utilisateur, pas de root dans le conteneur. Les fichiers servis restent à
# root : lisibles par tous, modifiables par personne d'autre.
RUN adduser -D -u 1000 caddyuser
USER caddyuser

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --spider -q http://localhost:80/ || exit 1
