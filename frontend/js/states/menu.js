// État "menu" (écran titre) : navigation clavier/souris entre les 4 options
// (JOUER, CLASSEMENT, AIDE, CRÉDITS — voir MENU_OPTIONS dans hud.js).
//
// Interface commune à tous les modules de states/ : update(g, engine, dt)
// fait avancer la logique d'une frame, draw(c2d, g) dessine l'écran. `g` est
// le même objet d'état partagé qu'avant la découpe de game.js (pas un
// sous-objet par état) — restructurer `g` lui-même toucherait chaque endroit
// qui le lit (hud.js compris) pour un gain surtout cosmétique, donc
// volontairement laissé de côté ici.
//
// `engine` regroupe les objets du moteur (input, audio, pools...) qu'un état
// n'a pas besoin de recréer, plus `engine.actions` : des rappels vers des
// actions qui déclenchent un autre état (démarrer une partie, aller au
// classement) — évite les imports circulaires entre modules de states/
// pendant que la découpe avance module par module. Nommé "engine" et pas
// "ctx" pour ne jamais se confondre avec le contexte Canvas2D (souvent
// appelé `ctx` lui aussi, y compris dans game.js).
import { consumeJustPressed } from "../input.js";
import { updateStarfield } from "../stars.js";
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
  updateStarfield(engine.starfield, dt, 1);
  syncHoverWithSound(engine.input, engine.audio, hud.hitTestMenu, () => g.menuSelected, (idx) => (g.menuSelected = idx));
  // +3 (pas -1) : JS calcule le modulo du résultat, pas de "index négatif" à gérer.
  if (consumeJustPressed(engine.input, "ArrowUp")) g.menuSelected = (g.menuSelected + 3) % 4;
  if (consumeJustPressed(engine.input, "ArrowDown")) g.menuSelected = (g.menuSelected + 1) % 4;
  if (consumeJustPressed(engine.input, "Enter")) selectMenuOption(g, engine, g.menuSelected);
}

export function draw(c2d, g) {
  hud.drawTitleScreen(c2d, g.elapsed, g.menuSelected);
}

export function handleTap(g, engine, x, y) {
  const idx = hud.hitTestMenu(x, y);
  if (idx >= 0) selectMenuOption(g, engine, idx);
}
