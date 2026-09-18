// Google Analytics (gtag.js) — chargement différé, déclenché uniquement par
// consent.js une fois le consentement accepté (jamais au chargement de la
// page). Le tag externe (googletagmanager.com) doit être autorisé sur
// script-src/connect-src côté CSP (repo d'infra séparé, middlewares.yml)
// sans quoi il est bloqué silencieusement par le navigateur.
import { GA_MEASUREMENT_ID } from "./config.js";

let loaded = false;

// Idempotent (comme music.start()/audio.ensure()) : consent.js peut
// rappeler cette fonction sans risque (ex: rechargement d'un onglet déjà
// consentant) sans jamais injecter le script deux fois.
export function loadAnalytics() {
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
