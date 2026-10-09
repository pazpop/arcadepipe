// Réglages propres à un déploiement, lus une fois dans site-config.json (une
// promesse : `(await siteConfig).apiBase`). Fichier absent ou illisible : aucun réglage.
//
// - gaMeasurementId : identifiant Google Analytics. Vide : pas de mesure
//   d'audience (voir consent.js).
// - apiBase : adresse de l'API du classement quand le jeu n'est pas hébergé au
//   même endroit qu'elle (itch.io). Vide : voir api.js.
//
// Qui écrit ce fichier : docs/deploiement.md.
export const siteConfig = fetch("site-config.json")
  .then((res) => res.json())
  .catch(() => ({}));
