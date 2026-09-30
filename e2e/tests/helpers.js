// Utilitaires partagés : le canvas interne fait RES_W x RES_H (480x270,
// voir frontend/js/config.js) quelle que soit sa taille affichée — toutes
// les interactions doivent passer par ces conversions plutôt que des
// coordonnées écran en dur.
//
// Forcer temporairement une constante (taux de drop, difficulté...) pour un
// test : aucun point d'accès de debug n'est exposé côté app (rien à
// trouver/exploiter en prod). Les modules ES sont mis en cache par URL —
// un import dynamique déclenché depuis page.evaluate() récupère le même
// module déjà évalué par la page, pas une copie :
//
//   await page.evaluate(async () => {
//     const { DIFFICULTY } = await import("/js/config.js");
//     DIFFICULTY.baseWaveKills = 1;
//   });
import { expect } from "@playwright/test";

export const RES_W = 480;
export const RES_H = 270;

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

// La plupart des tests veulent aller droit au gameplay — sans ça, l'aide de
// bienvenue (première partie) ou l'alerte boss (premier combat de boss)
// mettrait le jeu en pause automatiquement et fausserait silencieusement le
// test (pas d'erreur, mais rien de ce qui suit ne se produit vraiment).
// Un seul test dédié (menu-pause.spec.js) vérifie ces aides sans appeler ceci.
export async function skipHints(page) {
  await page.evaluate(() => {
    localStorage.setItem("arcadepipe_seen_intro", "1");
    // Le bandeau de consentement (consent.js) recouvre le bas de l'écran et
    // intercepterait les clics sur les boutons tactiles — le refuser d'avance.
    localStorage.setItem("arcadepipe_analytics_consent", "denied");
  });
  await page.evaluate(() => document.getElementById("cookie-banner")?.classList.add("hidden"));
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
      wave: game.getRunSummary().wave,
      inBonusLevel: game.inBonusLevel,
      buff: game.buffType,
      shield: game.shield,
      powerups: game.powerupsOnScreen,
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
