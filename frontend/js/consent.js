// Mesure d'audience (Google Analytics) et consentement RGPD.
//
// Désactivée par défaut. Elle ne s'active que si site-config.json contient un
// identifiant Google Analytics, écrit à la construction de l'image Docker
// (GA_MEASUREMENT_ID, voir docs/deploiement.md). Sans identifiant : ni script,
// ni cookie, ni bandeau, ni bouton "Cookies".
//
// Avec un identifiant, rien n'est chargé avant un "Accepter" explicite. Le
// choix ("granted" ou "denied") est mémorisé ; le bouton "Cookies" du panneau
// rouvre le bandeau, car retirer son accord doit être aussi simple que le donner.
import { STORAGE_KEYS } from "./config.js";
import { loadItem, saveItem } from "./storage.js";
import { loadAnalytics, disableAnalytics } from "./analytics.js";
import { siteConfig } from "./siteConfig.js";

export async function initConsent() {
  const measurementId = (await siteConfig).gaMeasurementId;
  if (!measurementId) return;

  // Stockage indisponible : le choix n'est pas mémorisé, le bandeau revient à chaque visite.
  const consent = loadItem(STORAGE_KEYS.analyticsConsent);
  if (consent === "granted") loadAnalytics(measurementId);

  const banner = document.getElementById("cookie-banner");
  if (consent !== "granted" && consent !== "denied") banner.classList.remove("hidden");
  document.getElementById("cookie-accept").addEventListener("click", () => {
    saveItem(STORAGE_KEYS.analyticsConsent, "granted");
    banner.classList.add("hidden");
    loadAnalytics(measurementId);
  });
  document.getElementById("cookie-decline").addEventListener("click", () => {
    saveItem(STORAGE_KEYS.analyticsConsent, "denied");
    banner.classList.add("hidden");
    disableAnalytics(measurementId);
  });
  const cookieBtn = document.getElementById("cookie-btn");
  cookieBtn.classList.remove("hidden");
  cookieBtn.addEventListener("click", () => banner.classList.remove("hidden"));
}
