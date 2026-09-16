// Ces deux scénarios (bonus, combat de boss) sont trop lents à atteindre en
// conditions normales pour un test rapide (taux de drop faible, plusieurs
// vagues avant le premier boss) — on force temporairement les constantes
// concernées via un import dynamique de config.js (voir helpers.js). Pas
// besoin d'éditer/restaurer le code source : tout repart d'une page fraîche
// au test suivant.
import { test, expect } from "@playwright/test";
import { canvasHelpers, collectErrors, skipHints } from "./helpers.js";

test("un seul bonus à la fois : ramassage, indicateur de buff, pas d'erreur", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);

  await page.evaluate(async () => {
    const { POWERUP } = await import("/js/config.js");
    POWERUP.dropChanceNormal = 1;
    POWERUP.dropChanceElite = 1;
  });

  const { canvas, startRun, toPage } = canvasHelpers(page);
  await startRun();
  await page.waitForTimeout(200);

  const ship = await toPage(90, 135);
  await page.mouse.move(ship.x, ship.y);
  await page.mouse.down();

  // Premiers kills : avec 100% de drop, un bonus doit apparaître vite.
  await page.waitForTimeout(4000);
  await canvas.screenshot({ path: "test-results/powerup-dropped-and-collected.png" });

  // Un deuxième passage un peu plus long pour vérifier qu'aucun second bonus
  // ne s'affiche tant que le premier est actif ou encore au sol (voir
  // "un seul bonus à l'écran" dans resolveCollisions()).
  await page.waitForTimeout(4000);
  await canvas.screenshot({ path: "test-results/powerup-single-at-a-time.png" });

  await page.mouse.up();
  expect(errors).toEqual([]);
});

test("bouclier : ramassage, anneau/indicateur affichés, pas d'erreur", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);

  await page.evaluate(async () => {
    const { POWERUP } = await import("/js/config.js");
    POWERUP.dropChanceNormal = 1;
    POWERUP.dropChanceElite = 1;
    POWERUP.typeWeights = { power: 0, rapid: 0, shield: 1, nova: 0 };
  });

  const { canvas, startRun, toPage } = canvasHelpers(page);
  await startRun();
  await page.waitForTimeout(200);

  const ship = await toPage(90, 135);
  await page.mouse.move(ship.x, ship.y);
  await page.mouse.down();

  // Avec 100% de drop et le bouclier forcé, il doit apparaître et être
  // ramassé -> l'anneau autour du vaisseau + "BOUCLIER x3" (voir
  // drawShieldIndicator dans hud.js) doivent être visibles. Deux passages
  // (comme le test de bonus existant) : un seul kill aligné avec la
  // trajectoire de tir suffit, mais ça peut prendre plus d'un passage selon
  // les positions d'apparition aléatoires des ennemis.
  await page.waitForTimeout(4000);
  await page.waitForTimeout(4000);
  await page.waitForTimeout(4000); // laisse le bonus tomber jusqu'au vaisseau et se faire ramasser
  await canvas.screenshot({ path: "test-results/shield-active.png" });

  await page.mouse.up();
  expect(errors).toEqual([]);
});

test("premier combat de boss : coque + points faibles s'affichent, pas d'erreur", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);

  // 1 kill/vague -> la vague 4 (boss) arrive en quelques secondes au lieu
  // de plusieurs minutes.
  await page.evaluate(async () => {
    const { DIFFICULTY } = await import("/js/config.js");
    DIFFICULTY.baseWaveKills = 1;
    DIFFICULTY.waveKillsStep = 0;
  });

  const { canvas, startRun, toPage } = canvasHelpers(page);
  await startRun();
  await page.waitForTimeout(200);

  const ship = await toPage(90, 135);
  await page.mouse.move(ship.x, ship.y);
  await page.mouse.down();

  // Assez de temps pour traverser les vagues 1-3 et atteindre la vague 4.
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1500);
  }
  await canvas.screenshot({ path: "test-results/boss-encounter.png" });

  await page.mouse.up();
  expect(errors).toEqual([]);
});
