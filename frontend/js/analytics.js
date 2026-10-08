// Google Analytics (gtag.js) — chargement différé, déclenché uniquement par
// consent.js une fois le consentement accepté (jamais au chargement de la
// page). Le tag externe (googletagmanager.com) doit être autorisé sur
// script-src/connect-src côté CSP (repo d'infra séparé, middlewares.yml)
// sans quoi il est bloqué silencieusement par le navigateur.
import { GA_MEASUREMENT_ID } from "./config.js";

let loaded = false;

// Interrupteur officiel de gtag.js : à true, plus aucune mesure n'est envoyée,
// même si le script est déjà chargé dans la page.
const DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}`;

// Retrait du consentement : coupe les envois et efface les cookies "_ga*"
// (posés sur le domaine parent, d'où l'essai sur chaque niveau de domaine).
export function disableAnalytics() {
  window[DISABLE_FLAG] = true;
  const host = window.location.hostname.split(".");
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (!name.startsWith("_ga")) continue;
    document.cookie = `${name}=; max-age=0; path=/`;
    for (let i = 0; i < host.length - 1; i++) {
      document.cookie = `${name}=; max-age=0; path=/; domain=.${host.slice(i).join(".")}`;
    }
  }
}

// Peut être rappelée (accepter, refuser, accepter à nouveau) : le script n'est injecté qu'une fois.
export function loadAnalytics() {
  window[DISABLE_FLAG] = false; // ré-accepté après un retrait (voir disableAnalytics)
  if (loaded) return;
  loaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);
}
