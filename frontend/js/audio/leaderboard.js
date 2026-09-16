// Client HTTP du leaderboard (API FastAPI). En dev (frontend servi sur le
// port 5500), l'API tourne séparément sur localhost:8000 ; en prod, même
// origine que le frontend (chemin relatif, routé par Traefik).
const API_BASE = window.location.port === "5500" ? "http://localhost:8000" : "";
const FETCH_TIMEOUT_MS = 5000;

export async function fetchTopScores(limit = 10) {
  const res = await fetch(`${API_BASE}/api/scores?limit=${limit}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function submitScore(playerName, score, wave = 1, kills = 0) {
  const res = await fetch(`${API_BASE}/api/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_name: playerName, score, wave, kills }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
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
}

export async function fetchGamesPlayedCount() {
  const res = await fetch(`${API_BASE}/api/games/count`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.count;
}
