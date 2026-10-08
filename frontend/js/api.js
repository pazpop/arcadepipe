// Client HTTP du leaderboard (API FastAPI). En dev (frontend servi sur le
// port 5500), l'API tourne séparément sur localhost:8000 ; en prod, même
// origine que le frontend (chemin relatif, routé par Traefik).
const API_BASE = window.location.port === "5500" ? "http://localhost:8000" : "";
const FETCH_TIMEOUT_MS = 5000;

// Cache court des lectures (classement, compteur de parties) : rouvrir le
// classement, ou enchaîner fin de partie puis classement, ne refait pas les
// mêmes requêtes. Seules les réponses réussies sont gardées. Vidé par les
// écritures ci-dessous (invalidate) ; la durée de vie borne le retard sur les
// scores des autres joueurs.
const CACHE_TTL_MS = 60_000;
const cache = new Map(); // chemin -> { at, data }

async function getJson(path) {
  const hit = cache.get(path);
  if (hit && performance.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const res = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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

export function fetchTopScores(limit = 10) {
  return getJson(`/api/scores?limit=${limit}`);
}

export async function submitScore(playerName, score, wave = 1, kills = 0) {
  const res = await fetch(`${API_BASE}/api/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_name: playerName, score, wave, kills }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  invalidate("/api/scores"); // le classement vient (peut-être) de changer
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Compteur global (toutes parties, pas seulement celles qui qualifient pour
// le top) — voir POST /api/games côté backend.
export async function recordGamePlayed() {
  await fetch(`${API_BASE}/api/games`, {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  invalidate("/api/games/count");
}

export async function fetchGamesPlayedCount() {
  return (await getJson("/api/games/count")).count;
}
