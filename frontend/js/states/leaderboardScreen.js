// État "classement" : révèle les scores un par un (effet de liste qui se déroule) une fois chargés ;
// on en sort toujours vers le menu.
import { consumeJustPressed } from "../input.js";
import { fetchTopScores, fetchGamesPlayedCount } from "../api.js";
import * as hud from "../hud.js";
import { MODE } from "./mode.js";

// Numéro de l'ouverture en cours : une réponse arrivée après une ouverture
// plus récente (double tap) est ignorée.
let token = 0;

export async function open(g) {
  const myToken = ++token;
  g.mode = MODE.LEADERBOARD;
  g.scores = null;
  g.scoresFailed = false;
  g.scoresRevealCount = 0;
  g.scoresRevealTimer = 0;
  let scores = null;
  try {
    scores = await fetchTopScores();
  } catch {
    /* scores reste null : "classement indisponible" */
  }
  if (myToken !== token) return;
  g.scores = scores;
  g.scoresFailed = scores === null;
  let gamesPlayed;
  try {
    gamesPlayed = await fetchGamesPlayedCount();
  } catch {
    gamesPlayed = null; // affichage masqué plutôt qu'un faux "0" (voir drawLeaderboardScreen)
  }
  if (myToken !== token) return;
  g.gamesPlayed = gamesPlayed;
}

export function update(g, engine, dt) {
  g.scoresRevealTimer -= dt;
  if (g.scores && g.scoresRevealTimer <= 0 && g.scoresRevealCount < g.scores.length) {
    g.scoresRevealCount += 1;
    g.scoresRevealTimer = 0.15;
  }
  if (consumeJustPressed(engine.input, "Escape") || consumeJustPressed(engine.input, "Enter")) {
    g.mode = MODE.MENU;
  }
}

export function draw(c2d, g) {
  hud.drawLeaderboardScreen(c2d, g.scores, g.scoresFailed, g.scoresRevealCount, g.gamesPlayed);
}

export function handleTap(g) {
  g.mode = MODE.MENU;
}
