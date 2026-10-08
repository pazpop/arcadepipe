// Google Analytics (gtag.js). Rien n'est chargé tant que consent.js n'appelle
// pas loadAnalytics, donc jamais sans identifiant ni sans consentement. Le
// reverse-proxy doit autoriser googletagmanager.com et google-analytics.com
// dans sa CSP, sinon le navigateur bloque le tag sans rien dire.

let loaded = false;

// Interrupteur officiel de gtag.js : à true, plus aucune mesure n'est envoyée,
// même si le script est déjà chargé dans la page.
function disableFlag(measurementId) {
  return `ga-disable-${measurementId}`;
}

// Peut être rappelée (accepter, refuser, accepter à nouveau) : le script n'est injecté qu'une fois.
export function loadAnalytics(measurementId) {
  window[disableFlag(measurementId)] = false;
  if (loaded) return;
  loaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", measurementId);
}

// Retrait du consentement : coupe les envois et efface les cookies "_ga*"
// (posés sur le domaine parent, d'où l'essai sur chaque niveau de domaine).
export function disableAnalytics(measurementId) {
  window[disableFlag(measurementId)] = true;
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
