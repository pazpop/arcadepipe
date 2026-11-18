// Fin de partie : écran "game_over" (rejouer, ou aller au classement), puis,
// pour un score qui entre dans le top, "name_entry" (saisie du pseudo) avant le classement.
import { STORAGE_KEYS } from "../config.js";
import { loadItem, saveItem } from "../storage.js";
import { consumeJustPressed, clearJustPressed } from "../input.js";
import { syncHoverWithSound } from "./navHelpers.js";
import { MODE } from "./mode.js";
import * as leaderboardScreen from "./leaderboardScreen.js";
import { qualifies, addScore, recordGamePlayed, TOP_SIZE } from "../scores.js";
import * as hud from "../hud.js";

// Pseudo utilisé tant que le joueur n'en a jamais saisi, comme sur les bornes d'arcade.
const DEFAULT_NAME = "AAA";

function lastPlayerName() {
  return loadItem(STORAGE_KEYS.lastPlayerName) || DEFAULT_NAME;
}

// Appelée par states/playing.js à la fin du ralenti de mort. La partie est
// comptée ici, quel que soit le choix du joueur ensuite.
export function open(g) {
  g.mode = MODE.GAME_OVER;
  // Le flash, la bannière et le clignotement du rappel « INTACT » ne s'effacent
  // qu'en partie : ils resteraient figés sur la scène.
  g.flash = 0;
  g.banner = null;
  g.intactBlink = 0;
  g.gameOverSelected = 0;
  g.newRecord = g.score > g.bestScore;
  if (g.newRecord) {
    g.bestScore = g.score;
    saveItem(STORAGE_KEYS.bestScore, g.score);
  }
  recordGamePlayed();
  g.scoreQualifies = qualifies(g.score);
}

// REJOUER : nouvelle partie aussitôt, sans saisie du nom. Un score qui entre
// dans le top y est inscrit sous le dernier pseudo saisi, avant startRun, qui
// remet les valeurs à zéro.
function replay(g, engine) {
  if (g.scoreQualifies) addScore(lastPlayerName(), g.score, g.wave, g.enemiesKilled);
  engine.actions.startRun();
}

// Seconde option : saisie du pseudo si le score entre dans le top, sinon le classement directement.
function goToLeaderboard(g, engine) {
  if (!g.scoreQualifies) {
    leaderboardScreen.open(g);
    return;
  }
  g.mode = MODE.NAME_ENTRY;
  g.nameEntry = lastPlayerName();
  // Certains mobiles n'ouvrent pas le clavier : le pseudo est pré-rempli, le
  // bouton VALIDER suffit, et un tap ailleurs rouvre le clavier (handleTapNameEntry).
  engine.nameInputEl.value = g.nameEntry;
  engine.nameInputEl.focus();
}

function selectGameOverOption(g, engine, index) {
  if (index === 0) replay(g, engine);
  else goToLeaderboard(g, engine);
}

export function confirmNameEntry(g, engine) {
  if (g.mode !== MODE.NAME_ENTRY) return;
  const name = g.nameEntry.trim() || DEFAULT_NAME;
  saveItem(STORAGE_KEYS.lastPlayerName, name);
  addScore(name, g.score, g.wave, g.enemiesKilled);
  engine.nameInputEl.blur();
  // L'Entrée qui vient de valider ne doit pas aussi refermer le classement.
  clearJustPressed(engine.input);
  leaderboardScreen.open(g);
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
  hud.drawDeathScreen(c2d, g, g.scoreQualifies ? TOP_SIZE : 0);
}

export function drawNameEntry(c2d, g) {
  hud.drawNameEntry(c2d, g, Math.floor(performance.now() / 400) % 2 === 0);
}

export function handleTapGameOver(g, engine, x, y) {
  const idx = hud.hitTestGameOver(x, y);
  if (idx >= 0) selectGameOverOption(g, engine, idx);
}

export function handleTapNameEntry(g, engine, x, y) {
  if (hud.hitTestNameEntryValidate(x, y)) confirmNameEntry(g, engine);
  else {
    // Rouvre le clavier virtuel s'il s'est refermé : le champ a gardé le
    // focus, il faut le lui retirer pour que le lui rendre ait un effet.
    engine.nameInputEl.blur();
    engine.nameInputEl.focus();
  }
}
