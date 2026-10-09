// État "aide" : ouvert depuis le menu, la pause, le bouton du panneau, ou
// automatiquement à la première partie (startRun, states/playing.js).
// g.helpReturnTo mémorise où revenir en le fermant. Quatre pages (g.helpPage),
// chacune du texte ou une légende, jamais les deux (drawInfoScreen, hud.js).
import { consumeJustPressed } from "../input.js";
import * as hud from "../hud.js";
import { MODE } from "./mode.js";
import { t } from "../i18n.js";

const HELP_PAGES = [
  {
    title: t("help.title"),
    sections: [
      { heading: t("help.move"), detail: t("help.move.detail") },
      { heading: t("help.fire"), detail: t("help.fire.detail") },
      { heading: t("help.nova"), detail: t("help.nova.detail") },
    ],
  },
  {
    title: t("help.title"),
    sections: [
      { heading: t("help.boss"), detail: t("help.boss.detail") },
      { heading: t("help.ram"), detail: t("help.ram.detail") },
      { heading: t("help.keys"), detail: t("help.keys.detail") },
    ],
  },
  {
    title: t("help.title.bonus"),
    showBonusLegend: true,
  },
  {
    title: t("help.title.enemies"),
    showEnemyLegend: true,
  },
];

export function open(g, from) {
  g.helpReturnTo = from;
  g.helpPage = 0;
  g.mode = MODE.HELP;
}

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
  if (hud.hitTestInfoContinue(x, y)) {
    close(g);
  } else if (hud.hitTestInfoPrev(x, y)) {
    goToPage(g, g.helpPage - 1);
  } else if (hud.hitTestInfoNext(x, y)) {
    goToPage(g, g.helpPage + 1);
  }
}
