// Téléphone en paysage (écran plus large que le 16:9 du jeu) : les commandes
// tactiles se rangent dans les bandes noires, sans recouvrir le jeu.
import { test, expect } from "@playwright/test";
import { canvasHelpers, skipHints, waitForMode } from "./helpers.js";

// storageState vide : le panneau garde son état par défaut (replié).
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, storageState: { cookies: [], origins: [] } });

test("téléphone en paysage : panneau replié, Pause et NOVA dans les bandes, jouable au doigt", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);

  // Le jeu garde son format 16:9, centré.
  const canvas = await page.locator("#game-canvas").boundingBox();
  expect(canvas.width / canvas.height).toBeCloseTo(16 / 9, 1);
  expect(canvas.x).toBeGreaterThan(60);

  // Panneau replié par défaut ; Pause et l'onglet sont dans la bande de gauche.
  await expect(page.locator("#mc-wrap")).toHaveClass(/collapsed/);
  // (attendu avec poll : le repli du panneau est animé)
  for (const id of ["#pause-btn", "#mc-toggle"]) {
    const rightEdge = async () => {
      const box = await page.locator(id).boundingBox();
      return box.x + box.width;
    };
    await expect.poll(rightEdge).toBeLessThanOrEqual(canvas.x);
  }

  // NOVA, quand il s'affiche, est dans la bande de droite (lu avant que la boucle du jeu ne le masque).
  const novaLeft = await page.evaluate(() => {
    const btn = document.getElementById("nova-btn");
    btn.classList.remove("hidden");
    return btn.getBoundingClientRect().left;
  });
  expect(novaLeft).toBeGreaterThanOrEqual(canvas.x + canvas.width);

  // Une partie se lance d'un tap, et le bouton Pause la met en pause.
  const { toPage } = canvasHelpers(page);
  const play = await toPage(240, 150);
  await page.touchscreen.tap(play.x, play.y);
  await waitForMode(page, "playing");
  await page.locator("#pause-btn").tap();
  await waitForMode(page, "paused");

  // Le bouton ⚙ ouvre le panneau, qui tient dans la hauteur de l'écran.
  await page.locator("#mc-toggle").tap();
  await expect(page.locator("#mc-wrap")).not.toHaveClass(/collapsed/);
  const panel = await page.locator("#music-controls").boundingBox();
  expect(panel.y).toBeGreaterThanOrEqual(0);
  expect(panel.y + panel.height).toBeLessThanOrEqual(390);
});
