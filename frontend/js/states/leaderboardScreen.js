// État "classement" — nommé leaderboardScreen (pas leaderboard.js, déjà pris
// par audio/leaderboard.js qui fait les appels fetch eux-mêmes). Révèle les
// scores un par un (effet de liste qui se déroule) une fois chargés,
// retour à g.leaderboardReturnTo (menu, ou fin de partie via goToLeaderboard).
import { consumeJustPressed } from "../input.js";
import { fetchTopScores, fetchGamesPlayedCount } from "../audio/leaderboard.js";
import * as hud from "../hud.js";
import { MODE } from "./mode.js";

// Jeton de version : un double-tap sur "Classement" lance deux fetch en
// parallèle ; sans garde, la réponse arrivée en second gagnerait même si
// périmée. Même correctif que _loadToken dans audio/music.js.
let token = 0;

export async function open(g, returnTo) {
  const myToken = ++token;
  g.mode = MODE.LEADERBOARD;
  g.leaderboardReturnTo = returnTo;
  g.scores = [];
  g.scoresRevealCount = 0;
  g.scoresRevealTimer = 0;
  let scores;
  try {
    scores = await fetchTopScores(10);
  } catch {
    scores = [];
  }
  if (myToken !== token) return; // supplantée par un appel plus récent
  g.scores = scores;
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
  if (g.scoresRevealTimer <= 0 && g.scoresRevealCount < g.scores.length) {
    g.scoresRevealCount += 1;
    g.scoresRevealTimer = 0.15;
  }
  if (consumeJustPressed(engine.input, "Escape") || consumeJustPressed(engine.input, "Enter")) {
    g.mode = g.leaderboardReturnTo;
  }
}

export function draw(c2d, g) {
  hud.drawLeaderboardScreen(c2d, g.scores, g.scoresRevealCount, g.gamesPlayed);
}

export function handleTap(g) {
  g.mode = g.leaderboardReturnTo;
}
