// État "aide" : écran par catégories, ouvert depuis le menu, la pause, ou
// automatiquement à la 1re partie (voir states/playing.js, startRun).
// g.helpReturnTo mémorise où revenir en le fermant (open() le pose).
//
// Réparti sur 4 pages (g.helpPage, voir open() ci-dessous) en une seule
// colonne chacune — plus lisible qu'un découpage en deux colonnes sur moins
// de pages, au prix de devoir tourner un peu plus souvent. Chaque page ne
// mélange jamais texte et légende (voir drawInfoScreen dans hud.js).
import { consumeJustPressed } from "../input.js";
import * as hud from "../hud.js";
import { MODE } from "./mode.js";

const HELP_PAGES = [
  {
    title: "AIDE",
    sections: [
      { heading: "DÉPLACEMENT", detail: "Souris ou doigt : dirige le vaisseau" },
      { heading: "TIR", detail: 'Maintiens le clic, ou coche "TIR AUTO" (bas à gauche)' },
      {
        heading: "NOVA",
        detail:
          "Frôle (sans le toucher) un tir ennemi ou un vaisseau ennemi — pas le boss — pour charger la jauge NOVA en haut à gauche, prends des risques ! Une fois pleine, ESPACE (ou le bouton tactile en bas à droite) détruit tous les ennemis normaux à l'écran, jamais le boss. Jusqu'à 2 charges en réserve après le 2e combat de boss (1 seule avant), à déclencher quand tu veux.",
      },
    ],
  },
  {
    title: "AIDE",
    sections: [
      { heading: "BOSS", detail: "Vise les points faibles JAUNES, évite sa coque — le vaincre donne +1 vie" },
      { heading: "MUSIQUE", detail: "Playlist aléatoire, réglable en bas à gauche" },
    ],
  },
  {
    title: "AIDE — BONUS",
    showBonusLegend: true,
  },
  {
    title: "AIDE — ENNEMIS",
    showEnemyLegend: true,
  },
];

export function open(g, from) {
  g.helpReturnTo = from;
  g.helpPage = 0; // toujours rouverte depuis le début, quelle que soit la page quittée la dernière fois
  g.mode = MODE.HELP;
}

// Pas exportée : utilisée uniquement en interne (update/handleTap ci-dessous).
function close(g) {
  g.mode = g.helpReturnTo;
  if (g.helpReturnTo === MODE.PAUSED) g.pauseStage = "menu";
}

function goToPage(g, page) {
  g.helpPage = Math.max(0, Math.min(HELP_PAGES.length - 1, page));
}

export function update(g, engine) {
  if (consumeJustPressed(engine.input, "ArrowLeft")) goToPage(g, g.helpPage - 1);
  if (consumeJustPressed(engine.input, "ArrowRight")) goToPage(g, g.helpPage + 1);
  if (
    consumeJustPressed(engine.input, "Enter") ||
    consumeJustPressed(engine.input, "KeyP") ||
    consumeJustPressed(engine.input, "Escape")
  ) {
    close(g);
  }
}

export function draw(c2d, g) {
  hud.drawInfoScreen(c2d, HELP_PAGES[g.helpPage], g.helpPage, HELP_PAGES.length);
}

export function handleTap(g, x, y) {
  if (hud.hitTestInfoContinue(x, y) === 0) {
    close(g);
  } else if (hud.hitTestInfoPrev(x, y) === 0) {
    goToPage(g, g.helpPage - 1);
  } else if (hud.hitTestInfoNext(x, y) === 0) {
    goToPage(g, g.helpPage + 1);
  }
}
