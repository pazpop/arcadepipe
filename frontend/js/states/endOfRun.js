// États "game_over" (écran de mort : REJOUER ou CLASSEMENT) et "name_entry"
// (saisie du pseudo avant le classement) — regroupés car ils forment la fin
// de partie : mort -> rejouer aussitôt (replay), ou mort -> saisir un nom ->
// classement (triggerGameOver).
import { STORAGE_KEYS } from "../config.js";
import { loadItem, saveItem } from "../storage.js";
import { consumeJustPressed } from "../input.js";
import { syncHoverWithSound } from "./navHelpers.js";
import { MODE } from "./mode.js";
import * as leaderboardScreen from "./leaderboardScreen.js";
import { fetchTopScores, submitScore, recordGamePlayed } from "../api.js";
import * as hud from "../hud.js";

// Pseudo mémorisé d'une partie à l'autre — pré-remplit la saisie du nom (triggerGameOver).
function readLastPlayerName() {
  return loadItem(STORAGE_KEYS.lastPlayerName);
}
function saveLastPlayerName(name) {
  saveItem(STORAGE_KEYS.lastPlayerName, name);
}

// Nom par défaut, comme sur les bornes d'arcade : utilisé tant que le joueur
// n'a jamais saisi de pseudo (REJOUER, ou clavier qui n'apparaît pas sur
// mobile, voir triggerGameOver).
const DEFAULT_NAME = "AAA";

// Le score entre-t-il dans le top 10 ? Backend indisponible : oui, on tente quand même.
async function qualifiesForTop(score) {
  try {
    const top = await fetchTopScores(10);
    return top.length < 10 || score > Math.min(...top.map((s) => s.score));
  } catch {
    return true;
  }
}

// REJOUER : nouvelle partie aussitôt, sans passer par la saisie du nom. Le
// score n'est pas perdu pour autant : s'il entre dans le top, il est envoyé
// en arrière-plan sous le pseudo mémorisé (ou DEFAULT_NAME, comme
// celui que la saisie aurait proposé). Valeurs lues avant startRun,
// qui les remet à zéro.
function replay(g, engine) {
  const { score, wave, enemiesKilled } = g;
  const name = readLastPlayerName() || DEFAULT_NAME;
  recordGamePlayed().catch(() => {});
  qualifiesForTop(score)
    .then((qualifies) => qualifies && submitScore(name, score, wave, enemiesKilled))
    .catch(() => {});
  engine.actions.startRun();
}

function selectGameOverOption(g, engine, index) {
  if (index === 0) replay(g, engine);
  else triggerGameOver(g, engine);
}

// CLASSEMENT : bascule GAME_OVER -> NAME_ENTRY (ou directement LEADERBOARD si
// le score ne qualifie pas).
async function triggerGameOver(g, engine) {
  g.mode = MODE.NAME_ENTRY;
  g.nameEntry = readLastPlayerName() || DEFAULT_NAME;
  // Comptabilisée dès la fin de partie, qualifiée ou non (POST /api/games).
  // Fire-and-forget : un échec réseau ne doit pas bloquer la suite.
  recordGamePlayed().catch(() => {});
  if (!(await qualifiesForTop(g.score))) {
    leaderboardScreen.open(g, MODE.MENU);
    return;
  }
  // focus() ici est hors du geste utilisateur d'origine (après un await) —
  // la plupart des mobiles refusent d'ouvrir le clavier virtuel dans ce
  // cas, sans erreur. D'où le nom par défaut déjà rempli et le bouton
  // "VALIDER" tactile (hitTestNameEntryValidate) pour valider sans clavier.
  if (engine.nameInputEl) {
    engine.nameInputEl.value = g.nameEntry;
    engine.nameInputEl.focus();
  }
}

// Garde contre une double soumission : g.mode ne change qu'après l'await
// submitScore ci-dessous, donc un second tap sur VALIDER (ou Entrée juste
// après un tap) pendant ce délai rappellerait confirmNameEntry une deuxième
// fois sans ce verrou — même famille de bug que _loadToken (audio/music.js)
// et le jeton de leaderboardScreen.js, mais ici on veut ignorer l'appel en
// trop plutôt que garder seulement le plus récent.
let submitting = false;

export async function confirmNameEntry(g, engine) {
  if (submitting) return;
  submitting = true;
  const name = (g.nameEntry || DEFAULT_NAME).trim() || DEFAULT_NAME;
  saveLastPlayerName(name); // repris pré-rempli à la prochaine partie (voir triggerGameOver)
  try {
    await submitScore(name, g.score, g.wave, g.enemiesKilled);
  } catch {
    /* échec silencieux : on affiche quand même le classement en l'état */
  } finally {
    submitting = false;
  }
  if (engine.nameInputEl) engine.nameInputEl.blur();
  leaderboardScreen.open(g, MODE.MENU);
}

export function setNameEntryText(g, text) {
  g.nameEntry = text.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 8);
}

export function updateGameOver(g, engine) {
  const { input, audio } = engine;
  syncHoverWithSound(input, audio, hud.hitTestGameOver, () => g.gameOverSelected, (idx) => (g.gameOverSelected = idx));
  if (consumeJustPressed(input, "ArrowUp") || consumeJustPressed(input, "ArrowDown")) {
    g.gameOverSelected = 1 - g.gameOverSelected;
  }
  if (consumeJustPressed(input, "Enter")) selectGameOverOption(g, engine, g.gameOverSelected);
  if (consumeJustPressed(input, "Escape")) triggerGameOver(g, engine);
}

// Overlay dessiné par-dessus la scène de jeu partagée (voir game.js draw) —
// contrairement à l'écran NAME_ENTRY, qui a son propre fond.
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
  if (hud.hitTestNameEntryValidate(x, y) === 0) confirmNameEntry(g, engine);
}
