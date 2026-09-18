// État "pause" : menu (reprendre/aide/quitter) + une confirmation avant de
// quitter (g.pauseStage "menu" | "confirmQuit") — perdre la progression sur
// un Entrée accidentel serait frustrant, d'où l'étape supplémentaire.
import { consumeJustPressed } from "../input.js";
import { syncHoverWithSound } from "./navHelpers.js";
import { MODE } from "./mode.js";
import * as helpState from "./help.js";
import * as hud from "../hud.js";

function selectPauseOption(g, index) {
  if (index === 0) {
    g.mode = MODE.PLAYING;
  } else if (index === 1) {
    helpState.open(g, MODE.PAUSED);
  } else {
    // Quitter perd la progression — confirmation demandée plutôt qu'un simple clic/Entrée.
    g.pauseStage = "confirmQuit";
    g.confirmQuitSelected = 1; // par défaut sur NON — un Entrée accidentel ne doit pas faire perdre la partie
  }
}

function selectConfirmQuitOption(g, index) {
  if (index === 0) {
    g.pauseStage = "menu";
    g.mode = MODE.MENU;
  } else {
    g.pauseStage = "menu";
  }
}

export function update(g, engine) {
  const { input, audio } = engine;
  if (g.pauseStage === "confirmQuit") {
    syncHoverWithSound(input, audio, hud.hitTestConfirmQuit, () => g.confirmQuitSelected, (idx) => (g.confirmQuitSelected = idx));
    if (consumeJustPressed(input, "ArrowUp") || consumeJustPressed(input, "ArrowDown")) {
      g.confirmQuitSelected = 1 - g.confirmQuitSelected;
    }
    if (consumeJustPressed(input, "Enter")) selectConfirmQuitOption(g, g.confirmQuitSelected);
    if (consumeJustPressed(input, "KeyP") || consumeJustPressed(input, "Escape")) {
      // Échap depuis la confirmation annule tout et reprend directement.
      g.pauseStage = "menu";
      g.mode = MODE.PLAYING;
    }
    return;
  }
  syncHoverWithSound(input, audio, hud.hitTestPause, () => g.pauseSelected, (idx) => (g.pauseSelected = idx));
  if (consumeJustPressed(input, "ArrowUp")) g.pauseSelected = (g.pauseSelected + 2) % 3;
  if (consumeJustPressed(input, "ArrowDown")) g.pauseSelected = (g.pauseSelected + 1) % 3;
  if (consumeJustPressed(input, "Enter")) selectPauseOption(g, g.pauseSelected);
  if (consumeJustPressed(input, "KeyP") || consumeJustPressed(input, "Escape")) {
    g.mode = MODE.PLAYING;
  }
}

export function draw(c2d, g) {
  if (g.pauseStage === "confirmQuit") {
    hud.drawConfirmQuitScreen(c2d, g.confirmQuitSelected);
  } else {
    hud.drawPauseScreen(c2d, g.pauseSelected);
  }
}

export function handleTap(g, x, y) {
  if (g.pauseStage === "confirmQuit") {
    const idx = hud.hitTestConfirmQuit(x, y);
    if (idx >= 0) selectConfirmQuitOption(g, idx);
  } else {
    const idx = hud.hitTestPause(x, y);
    if (idx >= 0) selectPauseOption(g, idx);
  }
}
