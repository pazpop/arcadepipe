// Utilitaires partagés. Le jeu raisonne en coordonnées logiques RES_W x RES_H
// (480x270, voir frontend/js/config.js) quelle que soit la taille du canvas :
// les clics passent par ces conversions, jamais par des coordonnées écran.
//
// Forcer une constante (taux de drop, difficulté...) pour un test : un import
// dynamique depuis page.evaluate() renvoie le module déjà chargé par la page,
// pas une copie. Aucun point d'accès de debug n'est exposé côté jeu.
//
//   await page.evaluate(async () => {
//     const { DIFFICULTY } = await import("/js/config.js");
//     DIFFICULTY.baseWaveKills = 1;
//   });
import { expect } from "@playwright/test";

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
      playerBullets: game.playerBulletsOnScreen,
      lives: game.lives,
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
