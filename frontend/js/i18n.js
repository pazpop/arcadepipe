// Traductions : un fichier par langue dans i18n/ (fr.js est la référence).
// Ajouter une langue = copier fr.js, le traduire, l'ajouter à LANGS ci-dessous.
import { STORAGE_KEYS } from "./config.js";
import { loadItem, saveItem } from "./storage.js";
import fr from "./i18n/fr.js";
import en from "./i18n/en.js";

export const LANGS = { fr, en };
const FALLBACK = "en"; // navigateur dans une langue non traduite

// Langue choisie (mémorisée), sinon celle du navigateur si elle est traduite.
function detectLang() {
  const saved = loadItem(STORAGE_KEYS.lang);
  if (saved in LANGS) return saved;
  const browser = (globalThis.navigator?.language || "").slice(0, 2).toLowerCase();
  return browser in LANGS ? browser : FALLBACK;
}

export const lang = detectLang();

// Texte de la clé dans la langue courante ; "{nom}" remplacé par params.nom.
// Clé absente d'une langue : repli sur le français, puis sur la clé elle-même.
export function t(key, params = {}) {
  const str = LANGS[lang][key] ?? fr[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
}

// ponytail: la page est rechargée au changement de langue (la partie en cours
// est perdue) — beaucoup de textes sont évalués une seule fois au chargement
// des modules. Les rendre dynamiques si changer de langue en jeu devient utile.
export function nextLang() {
  const codes = Object.keys(LANGS);
  saveItem(STORAGE_KEYS.lang, codes[(codes.indexOf(lang) + 1) % codes.length]);
  window.location.reload();
}

// Textes du HTML : data-i18n (contenu), data-i18n-title (infobulle),
// data-i18n-aria (aria-label). Le HTML ne contient aucun texte traduisible.
export function translateDom() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
}
