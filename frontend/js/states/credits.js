// État "crédits" : défilement automatique, accéléré en maintenant le tir ou
// d'un tap ; retour au menu en fin de liste ou sur Échap.
import { RES_H } from "../config.js";
import { consumeJustPressed } from "../input.js";
import * as hud from "../hud.js";
import { MODE } from "./mode.js";

export function update(g, engine, dt) {
  g.creditsScroll += dt * (engine.input.fireHeld ? 90 : 22);
  const totalHeight = hud.CREDITS_LINES.length * hud.CREDITS_LINE_HEIGHT + RES_H;
  if (g.creditsScroll > totalHeight || consumeJustPressed(engine.input, "Escape")) {
    g.mode = MODE.MENU;
  }
}

export function draw(c2d, g) {
  hud.drawCreditsScreen(c2d, g.creditsScroll);
}

export function handleTap(g) {
  g.creditsScroll += 60;
}
