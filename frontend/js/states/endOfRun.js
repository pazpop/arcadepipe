// Fin de partie : écran "game_over" (rejouer, ou aller au classement), puis,
// pour un score qui entre dans le top, "name_entry" (saisie du pseudo) avant le classement.
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

// L'envoi du score est en cours : une seconde validation du pseudo est ignorée.
let busy = false;

// Numéro de la fin de partie en cours : une réponse du serveur arrivée après
// qu'une autre partie s'est terminée est ignorée.
let opened = 0;

// Le score de la partie terminée entre-t-il dans le top ? Demandé une seule
// fois au serveur, à l'ouverture de l'écran ; les deux options attendent cette réponse.
let qualifies = Promise.resolve(false);

// Appelée par states/playing.js à la fin du ralenti de mort. La partie est
// comptée ici, quel que soit le choix du joueur ensuite ; un échec réseau est
// ignoré. L'écran annonce l'entrée dans le classement dès que le serveur a répondu.
export function open(g) {
  g.mode = MODE.GAME_OVER;
  g.flash = 0; // le flash ne décroît qu'en partie : il resterait figé sur la scène
  g.gameOverSelected = 0;
  g.scoreQualifies = false;
  g.leaderboardDown = false;
  g.gameOverWaiting = false;
  g.newRecord = g.score > g.bestScore;
  if (g.newRecord) {
    g.bestScore = g.score;
    saveItem(STORAGE_KEYS.bestScore, g.score);
  }
  recordGamePlayed().catch(() => {});
  const current = ++opened;
  qualifies = qualifiesForTop(g.score);
  qualifies.then((yes) => {
    if (current !== opened) return;
    g.scoreQualifies = yes === true;
    g.leaderboardDown = yes === null;
  });
}

// Le score entre-t-il dans le top ? true ou false ; jamais un score nul.
// null : serveur injoignable (traité comme un non, il ne pourrait pas y être
// envoyé, mais l'écran le dit au joueur).
async function qualifiesForTop(score) {
  if (score <= 0) return false;
  try {
    const top = await fetchTopScores();
    return top.length < TOP_SIZE || score > Math.min(...top.map((s) => s.score));
  } catch {
    return null;
  }
}

// REJOUER : nouvelle partie aussitôt, sans saisie du nom. Un score qui entre
// dans le top est envoyé en arrière-plan, sous le dernier pseudo saisi. Les
// valeurs sont lues avant startRun, qui les remet à zéro.
function replay(g, engine) {
  const { score, wave, enemiesKilled } = g;
  qualifies.then((yes) => yes && submitScore(lastPlayerName(), score, wave, enemiesKilled)).catch(() => {});
  engine.actions.startRun();
}

// Seconde option : saisie du pseudo si le score entre dans le top, sinon le classement directement.
async function goToLeaderboard(g, engine) {
  g.gameOverWaiting = true; // l'écran affiche "…" à côté de l'option (hud.js)
  const yes = await qualifies;
  g.gameOverWaiting = false;
  // Serveur lent : le joueur a pu rejouer, ou choisir une seconde fois, avant la réponse.
  if (g.mode !== MODE.GAME_OVER) return;
  if (!yes) {
    leaderboardScreen.open(g);
    return;
  }
  g.mode = MODE.NAME_ENTRY;
  g.nameEntry = lastPlayerName();
  // Hors du geste du joueur (après un await), la plupart des mobiles refusent
  // d'ouvrir le clavier : le pseudo est pré-rempli, le bouton VALIDER suffit,
  // et un tap ailleurs rouvre le clavier (handleTapNameEntry).
  engine.nameInputEl.value = g.nameEntry;
  engine.nameInputEl.focus();
}

function selectGameOverOption(g, engine, index) {
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
  hud.drawNameEntry(c2d, g.nameEntry, Math.floor(performance.now() / 400) % 2 === 0, g.score, g.wave, g.enemiesKilled);
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
