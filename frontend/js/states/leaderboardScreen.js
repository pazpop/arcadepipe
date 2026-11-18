// État "classement" (celui de cet appareil, scores.js) : révèle les scores un par un (effet de liste
// qui se déroule) ; on en sort toujours vers le menu.
import { consumeJustPressed } from "../input.js";
import { topScores, gamesPlayed } from "../scores.js";
import * as hud from "../hud.js";
import { MODE } from "./mode.js";

export function open(g) {
  g.mode = MODE.LEADERBOARD;
  g.scores = topScores();
  g.gamesPlayed = gamesPlayed();
  g.scoresRevealCount = 0;
  g.scoresRevealTimer = 0;
}

export function update(g, engine, dt) {
  g.scoresRevealTimer -= dt;
  if (g.scoresRevealTimer <= 0 && g.scoresRevealCount < g.scores.length) {
    g.scoresRevealCount += 1;
    g.scoresRevealTimer = 0.15;
  }
  if (consumeJustPressed(engine.input, "Escape") || consumeJustPressed(engine.input, "Enter")) {
    g.mode = MODE.MENU;
  }
}

export function draw(c2d, g) {
  hud.drawLeaderboardScreen(c2d, g.scores, g.scoresRevealCount, g.gamesPlayed);
}

export function handleTap(g) {
  g.mode = MODE.MENU;
}
