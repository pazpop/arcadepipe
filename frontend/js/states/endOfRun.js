// Fin de partie : écran "game_over" (REJOUER ou CLASSEMENT), puis, pour un
// score qui entre dans le top, "name_entry" (saisie du pseudo) avant le classement.
import { STORAGE_KEYS } from "../config.js";
import { loadItem, saveItem } from "../storage.js";
import { consumeJustPressed, clearJustPressed } from "../input.js";
import { syncHoverWithSound } from "./navHelpers.js";
import { MODE } from "./mode.js";
import * as leaderboardScreen from "./leaderboardScreen.js";
import { fetchTopScores, submitScore, recordGamePlayed, TOP_SIZE } from "../api.js";
import * as hud from "../hud.js";

// Pseudo utilisé tant que le joueur n'en a jamais saisi, comme sur les bornes d'arcade.
const DEFAULT_NAME = "AAA";

function lastPlayerName() {
  return loadItem(STORAGE_KEYS.lastPlayerName) || DEFAULT_NAME;
}

// Une requête de fin de partie est en cours : les clics et touches suivants
// sont ignorés jusqu'à sa réponse (pas de double envoi de score).
let busy = false;

// Appelée par states/playing.js à la fin du ralenti de mort. La partie est
// comptée ici, quel que soit le choix du joueur ensuite ; un échec réseau est ignoré.
export function open(g) {
  g.mode = MODE.GAME_OVER;
  g.gameOverSelected = 0;
  recordGamePlayed().catch(() => {});
}

// Le score entre-t-il dans le top ? Backend injoignable : oui, on tente quand même.
async function qualifiesForTop(score) {
  try {
    const top = await fetchTopScores();
    return top.length < TOP_SIZE || score > Math.min(...top.map((s) => s.score));
  } catch {
    return true;
  }
}

// REJOUER : nouvelle partie aussitôt, sans saisie du nom. Un score qui entre
// dans le top est envoyé en arrière-plan, sous le dernier pseudo saisi. Les
// valeurs sont lues avant startRun, qui les remet à zéro.
function replay(g, engine) {
  const { score, wave, enemiesKilled } = g;
  qualifiesForTop(score)
    .then((qualifies) => qualifies && submitScore(lastPlayerName(), score, wave, enemiesKilled))
    .catch(() => {});
  engine.actions.startRun();
}

// CLASSEMENT : saisie du pseudo si le score entre dans le top, sinon le classement directement.
async function goToLeaderboard(g, engine) {
  busy = true;
  const qualifies = await qualifiesForTop(g.score);
  busy = false;
  if (!qualifies) {
    leaderboardScreen.open(g, MODE.MENU);
    return;
  }
  g.mode = MODE.NAME_ENTRY;
  g.nameEntry = lastPlayerName();
  // Hors du geste du joueur (après un await), la plupart des mobiles refusent
  // d'ouvrir le clavier : le pseudo est pré-rempli, le bouton VALIDER suffit,
  // et un tap ailleurs rouvre le clavier (clic sur #game-container, main.js).
  engine.nameInputEl.value = g.nameEntry;
  engine.nameInputEl.focus();
}

function selectGameOverOption(g, engine, index) {
  if (busy) return;
  if (index === 0) replay(g, engine);
  else goToLeaderboard(g, engine);
}

export async function confirmNameEntry(g, engine) {
  if (busy || g.mode !== MODE.NAME_ENTRY) return;
  busy = true;
  const name = g.nameEntry.trim() || DEFAULT_NAME;
  saveItem(STORAGE_KEYS.lastPlayerName, name);
  try {
    await submitScore(name, g.score, g.wave, g.enemiesKilled);
  } catch {
    /* échec silencieux : le classement s'affiche quand même */
  }
  busy = false;
  engine.nameInputEl.blur();
  // L'Entrée qui vient de valider ne doit pas aussi refermer le classement.
  clearJustPressed(engine.input);
  leaderboardScreen.open(g, MODE.MENU);
}

// Garde les seuls caractères permis et renvoie le pseudo obtenu.
export function setNameEntryText(g, text) {
  g.nameEntry = text.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 8);
  return g.nameEntry;
}

export function updateGameOver(g, engine) {
  const { input, audio } = engine;
  syncHoverWithSound(input, audio, hud.hitTestGameOver, () => g.gameOverSelected, (idx) => (g.gameOverSelected = idx));
  if (consumeJustPressed(input, "ArrowUp") || consumeJustPressed(input, "ArrowDown")) {
    g.gameOverSelected = 1 - g.gameOverSelected;
  }
  if (consumeJustPressed(input, "Enter")) selectGameOverOption(g, engine, g.gameOverSelected);
  if (consumeJustPressed(input, "Escape")) selectGameOverOption(g, engine, 1);
}

// Dessiné par-dessus la scène de jeu figée (voir game.js, draw) ; l'écran de
// saisie du nom, lui, a son propre fond.
export function drawGameOverOverlay(c2d, g) {
  hud.drawDeathScreen(c2d, g.score, g.wave, g.enemiesKilled, g.distanceTraveled, g.gameOverSelected);
}

export function drawNameEntry(c2d, g) {
  hud.drawGameOverScreen(c2d, g.score, g.wave, g.enemiesKilled, g.distanceTraveled);
  hud.drawNameEntry(c2d, g.nameEntry, Math.floor(performance.now() / 400) % 2 === 0);
}

export function handleTapGameOver(g, engine, x, y) {
  const idx = hud.hitTestGameOver(x, y);
  if (idx >= 0) selectGameOverOption(g, engine, idx);
}

export function handleTapNameEntry(g, engine, x, y) {
  if (hud.hitTestNameEntryValidate(x, y)) confirmNameEntry(g, engine);
}
