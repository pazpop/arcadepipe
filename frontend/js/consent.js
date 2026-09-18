// Bannière de consentement (RGPD) — Google Analytics n'est chargé qu'après
// un choix explicite ("Accepter"), jamais par défaut. Le choix ("granted"
// ou "denied") est mémorisé pour ne pas redemander à chaque visite ; tant
// qu'aucun choix n'a été fait, la bannière reste affichée.
import { STORAGE_KEYS } from "./config.js";
import { loadAnalytics } from "./analytics.js";

function readConsent() {
  try {
    return localStorage.getItem(STORAGE_KEYS.analyticsConsent);
  } catch {
    return null; // stockage indisponible (navigation privée...) — redemande à chaque visite, pas bloquant
  }
}

function writeConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEYS.analyticsConsent, value);
  } catch {
    /* stockage indisponible — le choix ne sera juste pas mémorisé */
  }
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
