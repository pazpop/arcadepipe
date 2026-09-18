// État "aide" : écran unique par catégories, ouvert depuis le menu, la
// pause, ou automatiquement à la 1re partie (voir game.js, startRun).
// g.helpReturnTo mémorise où revenir en le fermant (open() le pose).
import { consumeJustPressed } from "../input.js";
import * as hud from "../hud.js";
import { MODE } from "./mode.js";

const HELP_INFO = {
  title: "AIDE",
  showBonusLegend: true, // dessine icône + couleur de chaque bonus (voir drawInfoScreen dans hud.js) à la place d'une ligne "BONUS" ici
  sections: [
    { heading: "DÉPLACEMENT", detail: "Souris ou doigt : dirige le vaisseau" },
    {
      heading: "TIR",
      detail:
        'Maintiens le clic, ou coche "TIR AUTO" (bas à gauche). NOVA (ESPACE ou bouton bas droite) une fois la jauge pleine — frôle les tirs ET les vaisseaux ennemis (pas le boss) pour la charger, prends des risques !',
    },
    { heading: "BOSS", detail: "Vise les points faibles JAUNES, évite sa coque — le vaincre donne +1 vie" },
    { heading: "MUSIQUE", detail: "Playlist aléatoire, réglable en bas à gauche" },
  ],
};

export function open(g, from) {
  g.helpReturnTo = from;
  g.mode = MODE.HELP;
}

export function close(g) {
  g.mode = g.helpReturnTo;
  if (g.helpReturnTo === MODE.PAUSED) g.pauseStage = "menu";
}

export function update(g, engine) {
  if (
    consumeJustPressed(engine.input, "Enter") ||
    consumeJustPressed(engine.input, "KeyP") ||
    consumeJustPressed(engine.input, "Escape")
  ) {
    close(g);
  }
}

export function draw(c2d) {
  hud.drawInfoScreen(c2d, HELP_INFO);
}

export function handleTap(g, x, y) {
  if (hud.hitTestInfoContinue(x, y) === 0) close(g);
}
