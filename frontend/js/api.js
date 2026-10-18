// Client HTTP du classement (API FastAPI).
import { siteConfig } from "./siteConfig.js";

// Où joindre l'API quand le déploiement ne le dit pas (apiBase, siteConfig.js) :
// localhost:8000 en développement (jeu servi sur le port 5500), sinon la même
// adresse que le jeu (chemin relatif, routé par le reverse-proxy).
const DEFAULT_API_BASE = window.location.port === "5500" ? "http://localhost:8000" : "";
const FETCH_TIMEOUT_MS = 5000;

// Abandonne la requête après FETCH_TIMEOUT_MS (AbortSignal.timeout ferait de
// même, mais n'existe pas sur les iPhone d'avant 2022).
function timeoutSignal() {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return controller.signal;
}

async function apiUrl(path) {
  return `${(await siteConfig).apiBase || DEFAULT_API_BASE}${path}`;
}

// Cache court des lectures (classement, compteur de parties) : rouvrir le
// classement ne refait pas les mêmes requêtes. Seules les réponses réussies
// sont gardées ; les écritures ci-dessous le vident (invalidate).
const CACHE_TTL_MS = 60_000;
const cache = new Map(); // chemin -> { at, data }

async function getJson(path) {
  const hit = cache.get(path);
  if (hit && performance.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const res = await fetch(await apiUrl(path), {
    signal: timeoutSignal(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  cache.set(path, { at: performance.now(), data });
  return data;
}

function invalidate(prefix) {
  for (const path of cache.keys()) {
    if (path.startsWith(prefix)) cache.delete(path);
  }
}

// Taille du classement affiché, et seuil pour y entrer.
export const TOP_SIZE = 10;

export function fetchTopScores() {
  return getJson(`/api/scores?limit=${TOP_SIZE}`);
}

export async function submitScore(playerName, score, wave, kills) {
  const res = await fetch(await apiUrl("/api/scores"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_name: playerName, score, wave, kills }),
    signal: timeoutSignal(),
  });
  invalidate("/api/scores"); // le classement vient (peut-être) de changer
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// Compteur global (toutes parties, pas seulement celles qui qualifient pour
// le top) — voir POST /api/games côté backend.
export async function recordGamePlayed() {
  await fetch(await apiUrl("/api/games"), {
    method: "POST",
    signal: timeoutSignal(),
  });
  invalidate("/api/games/count");
}

export async function fetchGamesPlayedCount() {
  return (await getJson("/api/games/count")).count;
}
