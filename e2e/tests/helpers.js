// Utilitaires partagés. Le jeu raisonne en coordonnées logiques RES_W x RES_H
// (480x270, voir frontend/js/config.js) quelle que soit la taille du canvas :
// les clics passent par ces conversions, jamais par des coordonnées écran.
//
// Forcer une constante (taux de drop, difficulté...) pour un test : voir e2e/README.md.
import { test as base, expect } from "@playwright/test";

export { expect };

// Le `test` de toute la suite : une erreur JavaScript non interceptée dans la
// page fait échouer le test, quel que soit ce qu'il vérifie par ailleurs.
export const test = base.extend({
  page: async ({ page }, use) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.addInitScript(recordDrawnTexts);
    await use(page);
    expect(pageErrors).toEqual([]);
  },
});

// Le texte du jeu est dessiné dans le canvas, donc absent du DOM. Ce script,
// injecté dans la page avant le jeu, note chaque texte dessiné dans le canvas
// du jeu (pas dans celui de l'image de partage) ; à chaque image,
// window.drawnTexts reçoit ceux de l'image précédente, complète.
function recordDrawnTexts() {
  let current = [];
  const fillText = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
    if (this.canvas.id === "game-canvas") current.push(String(text));
    return fillText.call(this, text, ...rest);
  };
  window.drawnTexts = [];
  const nextFrame = () => {
    window.drawnTexts = current;
    current = [];
    requestAnimationFrame(nextFrame);
  };
  requestAnimationFrame(nextFrame);
}

// Textes dessinés par le jeu à la dernière image, réunis en une seule chaîne
// (« dessiné » : un texte transparent ou recouvert y figure aussi) :
//   await expect.poll(() => screenText(page)).toContain("GAME OVER");
export function screenText(page) {
  return page.evaluate(() => window.drawnTexts.join("\n"));
}

const RES_W = 480;
const RES_H = 270;

export function canvasHelpers(page) {
  const canvas = page.locator("#game-canvas");

  async function toPage(logicalX, logicalY) {
    const box = await canvas.boundingBox();
    return {
      x: box.x + (logicalX / RES_W) * box.width,
      y: box.y + (logicalY / RES_H) * box.height,
    };
  }

  async function clickLogical(logicalX, logicalY) {
    const p = await toPage(logicalX, logicalY);
    await page.mouse.click(p.x, p.y);
  }

  async function moveLogical(logicalX, logicalY) {
    const p = await toPage(logicalX, logicalY);
    await page.mouse.move(p.x, p.y);
  }

  // "JOUER" au menu, puis attend que la partie ait vraiment démarré. `expected` :
  // "help" quand l'aide de bienvenue doit s'ouvrir (première partie, sans skipHints).
  async function startRun(expected = "playing") {
    await clickLogical(240, 150);
    await waitForMode(page, expected);
  }

  return { canvas, toPage, clickLogical, moveLogical, startRun };
}

// La plupart des tests vont droit au jeu. Sans ça, l'aide de bienvenue de la
// première partie s'ouvrirait et le test continuerait sans rien jouer. Un test
// dédié (menu-pause.spec.js) vérifie cette aide sans appeler ceci.
export async function skipHints(page) {
  await page.evaluate(() => localStorage.setItem("arcadepipe_seen_intro", "1"));
}

// Active la mesure d'audience, désactivée par défaut (frontend/site-config.json) :
// à appeler avant page.goto(). Le jeu affiche alors le bandeau de consentement.
export async function enableAnalytics(page) {
  await page.route("**/site-config.json", (route) => route.fulfill({ json: { gaMeasurementId: "G-TEST" } }));
}

// État du jeu lu dans la page (main.js exporte l'instance `game`, voir
// e2e/README.md). Les clics passent par handleTap, traité aussitôt ; les
// touches, elles, ne sont lues qu'à la frame suivante : après une touche,
// toujours attendre l'état attendu plutôt qu'un délai fixe.
export function gameState(page) {
  return page.evaluate(async () => {
    const { game } = await import("/js/main.js");
    return {
      mode: game.mode,
      helpPage: game.helpPage,
      player: game.playerPosition,
      playerBullets: game.playerBulletsOnScreen,
      lives: game.lives,
      scores: game.scores,
      scoreQualifies: game.scoreQualifies,
      grazeChain: game.grazeChain,
      novaStock: game.novaStock,
      kills: game.getRunSummary().kills,
      wave: game.getRunSummary().wave,
      inBonusLevel: game.inBonusLevel,
      buff: game.buffType,
      shield: game.shield,
      powerups: game.powerupsOnScreen,
      boss: game.bossState,
      bossBullets: game.bossBulletsOnScreen,
    };
  });
}

export async function waitForMode(page, mode, timeout = 5000) {
  await expect.poll(async () => (await gameState(page)).mode, { timeout }).toBe(mode);
}

export function collectErrors(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
  return errors;
}

// Boss dès la vague 1 (aucun ennemi ordinaire, donc aucun coup pris au hasard
// avant lui) ; tire jusqu'à son arrivée. bossWave = 2 : une première vague
// d'un seul ennemi, pour arriver au boss avec un score non nul.
export async function reachBoss(page, bossWave = 1) {
  await page.evaluate(async (wave) => {
    const { DIFFICULTY } = await import("/js/config.js");
    DIFFICULTY.bossWaveEvery = wave;
    DIFFICULTY.baseWaveKills = 1;
    DIFFICULTY.waveKillsStep = 0;
  }, bossWave);
  const { startRun, toPage } = canvasHelpers(page);
  await startRun();
  await page.mouse.down();
  for (let i = 0; i < 100 && !(await gameState(page)).boss?.arrived; i++) {
    const p = await toPage(90, 30 + (i % 8) * 30);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(300);
  }
  expect((await gameState(page)).boss?.arrived).toBe(true);
}
