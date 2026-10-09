// Traductions : un fichier par langue dans i18n/ (fr.js est la référence).
// Ajouter une langue = copier fr.js, le traduire, l'ajouter à LANGS ci-dessous.
import { STORAGE_KEYS } from "./config.js";
import { loadItem, saveItem } from "./storage.js";
import fr from "./i18n/fr.js";
import en from "./i18n/en.js";

export const LANGS = { fr, en };
const FALLBACK = "en"; // navigateur dans une langue non traduite

const isTranslated = (code) => Object.keys(LANGS).includes(code);

// Langue demandée dans l'adresse (?lang=en, posé par nextLang), sinon celle
// mémorisée, sinon celle du navigateur si elle est traduite. L'adresse passe en
// premier : quand le stockage est bloqué (jeu embarqué dans une autre page),
// rien d'autre ne survit au rechargement.
function detectLang() {
  const asked = new URLSearchParams(globalThis.location?.search).get("lang");
  if (isTranslated(asked)) return asked;
  const saved = loadItem(STORAGE_KEYS.lang);
  if (isTranslated(saved)) return saved;
  const browser = (globalThis.navigator?.language || "").slice(0, 2).toLowerCase();
  return isTranslated(browser) ? browser : FALLBACK;
}

export const lang = detectLang();

// Langue proposée par le bouton de langue : la suivante dans LANGS.
const codes = Object.keys(LANGS);
export const nextLangCode = codes[(codes.indexOf(lang) + 1) % codes.length];

// Texte de la clé dans la langue courante ; "{nom}" remplacé par params.nom.
// Clé absente d'une langue : repli sur le français, puis sur la clé elle-même.
export function t(key, params = {}) {
  const str = LANGS[lang][key] ?? fr[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
}

// La page est rechargée au changement de langue (la partie en cours
// est perdue) : beaucoup de textes sont évalués une seule fois, au chargement
// des modules.
export function nextLang() {
  saveItem(STORAGE_KEYS.lang, nextLangCode);
  window.location.search = `?lang=${nextLangCode}`; // recharge la page à cette adresse
}

// Textes du HTML : data-i18n (contenu), data-i18n-title (infobulle),
// data-i18n-aria (aria-label). Le HTML ne contient aucun texte traduisible.
export function translateDom() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
}
