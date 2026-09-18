// Google Analytics (gtag.js) — fichier séparé plutôt qu'un <script> inline
// dans index.html : la CSP du site (voir terraform-infra-pazpop-hetzner,
// docker/traefik/dynamic/middlewares.yml) n'autorise pas 'unsafe-inline' sur
// script-src, seulement 'self' (+ googletagmanager.com pour le tag externe).
// Un fichier hébergé ici passe déjà par 'self', sans avoir à affaiblir la
// CSP davantage pour tout le portail.
window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}
gtag("js", new Date());
gtag("config", "G-YC4WFVN9JY");
