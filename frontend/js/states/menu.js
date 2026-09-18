// État "menu" (écran titre) : navigation clavier/souris entre les 4 options
// (JOUER, CLASSEMENT, AIDE, CRÉDITS — voir MENU_OPTIONS dans hud.js).
//
// Interface commune aux modules de states/ : update(g, engine, dt) fait
// avancer l'écran d'une frame, draw(c2d, g) le dessine. `g` est l'état partagé
// (un seul objet plat, pas un sous-objet par écran). `engine` regroupe le
// moteur (input, audio, pools...) plus `engine.actions` : des rappels pour
// passer à un autre écran sans import circulaire. "engine" et pas "ctx", qui
// désigne le contexte Canvas2D.
import { consumeJustPressed } from "../input.js";
import { drawTwinkleStars } from "../stars.js";
import { syncHoverWithSound } from "./navHelpers.js";
import { MODE } from "./mode.js";
import * as hud from "../hud.js";

function selectMenuOption(g, engine, index) {
  if (index === 0) engine.actions.startRun();
  else if (index === 1) engine.actions.goToLeaderboard(MODE.MENU);
  else if (index === 2) {
    g.helpReturnTo = MODE.MENU;
    g.mode = MODE.HELP;
  } else if (index === 3) {
    g.mode = MODE.CREDITS;
    g.creditsScroll = 0;
  }
}

export function update(g, engine, dt) {
  g.elapsed += dt;
  // Le défilement du champ d'étoiles est centralisé dans game.js (même fond
  // pour tous les écrans-menus) — voir son update().
  syncHoverWithSound(engine.input, engine.audio, hud.hitTestMenu, () => g.menuSelected, (idx) => (g.menuSelected = idx));
  // +3 (pas -1) : JS calcule le modulo du résultat, pas de "index négatif" à gérer.
  if (consumeJustPressed(engine.input, "ArrowUp")) g.menuSelected = (g.menuSelected + 3) % 4;
  if (consumeJustPressed(engine.input, "ArrowDown")) g.menuSelected = (g.menuSelected + 1) % 4;
  if (consumeJustPressed(engine.input, "Enter")) selectMenuOption(g, engine, g.menuSelected);
}

export function draw(c2d, g) {
  drawTwinkleStars(c2d, g.menuTwinkleStars, g.elapsed);
  hud.drawTitleScreen(c2d, g.elapsed, g.menuSelected);
}

export function handleTap(g, engine, x, y) {
  const idx = hud.hitTestMenu(x, y);
  if (idx >= 0) selectMenuOption(g, engine, idx);
}
