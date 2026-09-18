// Bannière de consentement (RGPD) — Google Analytics n'est chargé qu'après
// un choix explicite ("Accepter"), jamais par défaut. Le choix ("granted"
// ou "denied") est mémorisé pour ne pas redemander à chaque visite ; tant
// qu'aucun choix n'a été fait, la bannière reste affichée.
import { STORAGE_KEYS } from "./config.js";
import { loadItem, saveItem } from "./storage.js";
import { loadAnalytics } from "./analytics.js";

// Stockage indisponible : le choix n'est pas mémorisé, on redemande à chaque visite.
function readConsent() {
  return loadItem(STORAGE_KEYS.analyticsConsent);
}

function writeConsent(value) {
  saveItem(STORAGE_KEYS.analyticsConsent, value);
}

export function initConsent() {
  const consent = readConsent();
  if (consent === "granted") {
    loadAnalytics();
    return;
  }
  if (consent === "denied") return;

  const banner = document.getElementById("cookie-banner");
  const acceptBtn = document.getElementById("cookie-accept");
  const declineBtn = document.getElementById("cookie-decline");
  if (!banner || !acceptBtn || !declineBtn) return;

  banner.classList.remove("hidden");
  acceptBtn.addEventListener("click", () => {
    writeConsent("granted");
    banner.classList.add("hidden");
    loadAnalytics();
  });
  declineBtn.addEventListener("click", () => {
    writeConsent("denied");
    banner.classList.add("hidden");
  });
}
