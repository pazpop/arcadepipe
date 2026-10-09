# Pas de build step (vanilla JS) : fichiers statiques servis par Caddy, avec un
# Caddyfile personnalisé (compression, route /api/*).
# Épinglé par digest (voir docs/deploiement.md) ; Dependabot propose les mises à jour.
FROM mirror.gcr.io/library/caddy:2-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b

COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html privacy.html /usr/share/caddy/
COPY robots.txt /usr/share/caddy/
COPY favicon.svg og-image.png /usr/share/caddy/
COPY css/ /usr/share/caddy/css/
COPY js/ /usr/share/caddy/js/
COPY lib/ /usr/share/caddy/lib/
COPY music/ /usr/share/caddy/music/
COPY press/ /usr/share/caddy/press/

# Réglages de ce déploiement, lus par le jeu au chargement (js/siteConfig.js).
# GA_MEASUREMENT_ID : identifiant Google Analytics ; vide par défaut, donc
# aucune mesure d'audience (voir docs/deploiement.md).
ARG GA_MEASUREMENT_ID=""
RUN printf '{ "gaMeasurementId": "%s" }\n' "$GA_MEASUREMENT_ID" > /usr/share/caddy/site-config.json

# Numéro de version affiché dans le jeu : calculé par la CI (nombre de commits,
# voir .github/workflows/deploy.yml). Sans lui, le jeu affiche "dev". Le grep
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
