// État "menu" (écran titre) : JOUER, CLASSEMENT, AIDE, CRÉDITS (MENU_OPTIONS, hud.js).
//
// Comme les autres modules de states/ : update() fait avancer l'écran d'une
// frame, draw() le dessine, handleTap() traite un clic ou un tap. `g` est
// l'état partagé du jeu (un seul objet, voir game.js). `engine` regroupe le
// reste (input, audio, pools...) et `engine.actions.startRun`, qui lance une
// partie sans import circulaire.
import { consumeJustPressed } from "../input.js";
import { drawTwinkleStars } from "../stars.js";
import { syncHoverWithSound } from "./navHelpers.js";
import { MODE } from "./mode.js";
import * as helpState from "./help.js";
import * as leaderboardScreen from "./leaderboardScreen.js";
import * as hud from "../hud.js";

function selectMenuOption(g, engine, index) {
  if (index === 0) engine.actions.startRun();
  else if (index === 1) leaderboardScreen.open(g);
  else if (index === 2) helpState.open(g, MODE.MENU);
  else if (index === 3) {
    g.mode = MODE.CREDITS;
    g.creditsScroll = 0;
  }
}

export function update(g, engine, dt) {
  g.elapsed += dt;
  syncHoverWithSound(engine.input, engine.audio, hud.hitTestMenu, () => g.menuSelected, (idx) => (g.menuSelected = idx));
  const count = hud.MENU_OPTIONS.length;
  // + count - 1 plutôt que - 1 : le modulo d'un nombre négatif resterait négatif.
  if (consumeJustPressed(engine.input, "ArrowUp")) g.menuSelected = (g.menuSelected + count - 1) % count;
  if (consumeJustPressed(engine.input, "ArrowDown")) g.menuSelected = (g.menuSelected + 1) % count;
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
