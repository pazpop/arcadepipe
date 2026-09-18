// État "crédits" : défilement auto (accéléré en maintenant le tir), retour
// au menu en fin de liste, sur Échap, ou sur un tap (avance manuellement).
import { RES_H } from "../config.js";
import { consumeJustPressed } from "../input.js";
import * as hud from "../hud.js";
import { MODE } from "./mode.js";

export function update(g, engine, dt) {
  g.creditsScroll += dt * (engine.input.fireHeld ? 90 : 22);
  const totalHeight = hud.CREDITS_LINES.length * 16 + RES_H;
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
