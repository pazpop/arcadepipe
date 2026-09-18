// États "game_over" (écran de mort, bouton continuer) et "name_entry" (saisie
// du pseudo avant le classement) — regroupés car ils forment une seule
// séquence linéaire (mort -> continuer -> saisir un nom -> classement) sans
// retour possible en arrière, contrairement aux autres écrans à options.
import { STORAGE_KEYS } from "../config.js";
import { consumeJustPressed } from "../input.js";
import { syncHover } from "./navHelpers.js";
import { MODE } from "./mode.js";
import * as leaderboardScreen from "./leaderboardScreen.js";
import { fetchTopScores, submitScore, recordGamePlayed } from "../audio/leaderboard.js";
import * as hud from "../hud.js";

// Pseudo mémorisé d'une partie à l'autre — pré-remplit la saisie du nom (triggerGameOver).
function readLastPlayerName() {
  try {
    return localStorage.getItem(STORAGE_KEYS.lastPlayerName);
  } catch {
    return null;
  }
}
function saveLastPlayerName(name) {
  try {
    localStorage.setItem(STORAGE_KEYS.lastPlayerName, name);
  } catch {
    /* stockage indisponible — pas bloquant */
  }
}

// Nom par défaut aléatoire — évite un "PILOTE" générique si le clavier
// n'apparaît pas (mobile, voir triggerGameOver).
function randomPilotName() {
  const n = 10 + Math.floor(Math.random() * 90); // 2 chiffres pile : "PILOTE" (6) + "42" = 8 car. max
  return `PILOTE${n}`;
}

// Bascule PLAYING -> NAME_ENTRY (ou directement LEADERBOARD si le score ne
// qualifie pas) à la fin de la séquence de mort (voir g.dying dans playing).
export async function triggerGameOver(g, engine) {
  g.mode = MODE.NAME_ENTRY;
  g.nameEntry = readLastPlayerName() || randomPilotName();
  // Comptabilisée dès la fin de partie, qualifiée ou non (POST /api/games).
  // Fire-and-forget : un échec réseau ne doit pas bloquer la suite.
  recordGamePlayed().catch(() => {});
  let qualifies;
  try {
    const top = await fetchTopScores(10);
    qualifies = top.length < 10 || g.score > Math.min(...top.map((s) => s.score));
  } catch {
    qualifies = true; // backend indisponible : on tente quand même la saisie
  }
  if (!qualifies) {
    leaderboardScreen.open(g, MODE.MENU);
    return;
  }
  // focus() ici est hors du geste utilisateur d'origine (après un await) —
  // la plupart des mobiles refusent d'ouvrir le clavier virtuel dans ce
  // cas, sans erreur. D'où le nom aléatoire déjà rempli et le bouton
  // "VALIDER" tactile (hitTestNameEntryValidate) pour valider sans clavier.
  if (engine.nameInputEl) {
    engine.nameInputEl.value = g.nameEntry;
    engine.nameInputEl.focus();
  }
}

export async function confirmNameEntry(g, engine) {
  const name = (g.nameEntry || "PILOTE").trim() || "PILOTE";
  saveLastPlayerName(name); // repris pré-rempli à la prochaine partie (voir triggerGameOver)
  try {
    await submitScore(name, g.score, g.wave, g.enemiesKilled);
  } catch {
    /* échec silencieux : on affiche quand même le classement en l'état */
  }
  if (engine.nameInputEl) engine.nameInputEl.blur();
  leaderboardScreen.open(g, MODE.MENU);
}

export function setNameEntryText(g, text) {
  g.nameEntry = text.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 8);
}

export function updateGameOver(g, engine) {
  syncHover(engine.input, hud.hitTestGameOverContinue, () => {});
  if (consumeJustPressed(engine.input, "Enter") || consumeJustPressed(engine.input, "Escape")) {
    triggerGameOver(g, engine);
  }
}

// Overlay dessiné par-dessus la scène de jeu partagée (voir game.js draw) —
// contrairement à l'écran NAME_ENTRY, qui a son propre fond.
export function drawGameOverOverlay(c2d, g) {
  hud.drawDeathScreen(c2d, g.score, g.wave, g.enemiesKilled);
}

export function drawNameEntry(c2d, g) {
  hud.drawGameOverScreen(c2d, g.score, g.wave, g.enemiesKilled);
  hud.drawNameEntry(c2d, g.nameEntry, Math.floor(performance.now() / 400) % 2 === 0);
}

export function handleTapGameOver(g, engine, x, y) {
  if (hud.hitTestGameOverContinue(x, y) === 0) triggerGameOver(g, engine);
}

export function handleTapNameEntry(g, engine, x, y) {
  if (hud.hitTestNameEntryValidate(x, y) === 0) confirmNameEntry(g, engine);
}
