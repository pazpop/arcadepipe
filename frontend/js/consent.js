// Bannière de consentement (RGPD) — Google Analytics n'est chargé qu'après
// un choix explicite ("Accepter"), jamais par défaut. Le choix ("granted"
// ou "denied") est mémorisé pour ne pas redemander à chaque visite ; tant
// qu'aucun choix n'a été fait, la bannière reste affichée. Le bouton
// "Cookies" du panneau la rouvre : retirer son accord doit être aussi simple
// que le donner.
import { STORAGE_KEYS } from "./config.js";
import { loadItem, saveItem } from "./storage.js";
import { loadAnalytics, disableAnalytics } from "./analytics.js";

export function initConsent() {
  // Stockage indisponible : le choix n'est pas mémorisé, le bandeau revient à chaque visite.
  const consent = loadItem(STORAGE_KEYS.analyticsConsent);
  if (consent === "granted") loadAnalytics();

  const banner = document.getElementById("cookie-banner");
  const acceptBtn = document.getElementById("cookie-accept");
  const declineBtn = document.getElementById("cookie-decline");
  if (!banner || !acceptBtn || !declineBtn) return;

  if (consent !== "granted" && consent !== "denied") banner.classList.remove("hidden");
  acceptBtn.addEventListener("click", () => {
    saveItem(STORAGE_KEYS.analyticsConsent, "granted");
    banner.classList.add("hidden");
    loadAnalytics();
  });
  declineBtn.addEventListener("click", () => {
    saveItem(STORAGE_KEYS.analyticsConsent, "denied");
    banner.classList.add("hidden");
    disableAnalytics();
  });
  document.getElementById("cookie-btn")?.addEventListener("click", () => banner.classList.remove("hidden"));
}
