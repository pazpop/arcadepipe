// Tests pour le cache des lectures de api.js (classement, compteur de parties).
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

// api.js lit window.location au chargement et appelle fetch : simulés ici.
globalThis.window = { location: { port: "" } };
let calls = [];
let ok = true;
globalThis.fetch = async (url, opts = {}) => {
  calls.push(`${opts.method || "GET"} ${url}`);
  return { ok, status: ok ? 200 : 500, json: async () => (url.includes("count") ? { count: 7 } : [{ score: 100 }]) };
};
const { fetchTopScores, submitScore, fetchGamesPlayedCount, recordGamePlayed } = await import("./api.js");

test("deux lectures du classement : une seule requête", async () => {
  calls = [];
  assert.deepEqual(await fetchTopScores(10), [{ score: 100 }]);
  await fetchTopScores(10);
  assert.deepEqual(calls, ["GET /api/scores?limit=10"]);
});

test("soumettre un score vide le cache du classement, pas celui du compteur", async () => {
  await fetchGamesPlayedCount();
  calls = [];
  await submitScore("AAA", 500);
  await fetchTopScores(10);
  assert.equal(await fetchGamesPlayedCount(), 7);
  assert.deepEqual(calls, ["POST /api/scores", "GET /api/scores?limit=10"]);
});

test("compter une partie vide le cache du compteur", async () => {
  calls = [];
  await recordGamePlayed();
  await fetchGamesPlayedCount();
  assert.deepEqual(calls, ["POST /api/games", "GET /api/games/count"]);
});

test("une réponse en erreur n'est pas gardée", async () => {
  await submitScore("AAA", 500); // vide le cache
  ok = false;
  await assert.rejects(fetchTopScores(10));
  ok = true;
  calls = [];
  await fetchTopScores(10);
  assert.deepEqual(calls, ["GET /api/scores?limit=10"]);
});
