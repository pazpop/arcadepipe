// Téléphone en paysage (écran plus large que le 16:9 du jeu) : les commandes
// tactiles se rangent dans les bandes noires, sans recouvrir le jeu.
import { test, expect, canvasHelpers, gameState, skipHints, waitForMode } from "./helpers.js";

// storageState vide : le panneau garde son état par défaut (replié).
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, storageState: { cookies: [], origins: [] } });

test("téléphone en paysage : commandes dans les bandes, vaisseau piloté et tir au doigt, Pause d'un second doigt", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(() => localStorage.setItem("arcadepipe_autofire", "0")); // tir au doigt maintenu
  await page.reload();

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

  // Une partie se lance d'un tap ; le vaisseau rejoint le doigt, décalé vers
  // l'avant (INPUT.touchXOffset), et tire. Le bouton Pause met en pause.
  const { toPage } = canvasHelpers(page);
  const play = await toPage(240, 150);
  await page.touchscreen.tap(play.x, play.y);
  await waitForMode(page, "playing");
  const finger = await toPage(150, 60);
  await page.touchscreen.tap(finger.x, finger.y);
  await expect.poll(async () => Math.round((await gameState(page)).player.y), { timeout: 8000 }).toBe(60);
  expect((await gameState(page)).player.x).toBeGreaterThan(150);
  expect((await gameState(page)).playerBullets).toBe(0); // doigt levé : pas de tir

  // Doigt maintenu : le vaisseau tire. Un second doigt sur Pause met en pause
  // (deux doigts à la fois : hors de portée de page.touchscreen, d'où le protocole du navigateur).
  const cdp = await page.context().newCDPSession(page);
  const steer = { ...finger, id: 1 };
  const pauseBox = await page.locator("#pause-btn").boundingBox();
  const thumb = { x: pauseBox.x + pauseBox.width / 2, y: pauseBox.y + pauseBox.height / 2, id: 2 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [steer] });
  await expect.poll(async () => (await gameState(page)).playerBullets).toBeGreaterThan(0);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [steer, thumb] });
  await waitForMode(page, "paused");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  // Le bouton ⚙ ouvre le panneau, qui tient dans la hauteur de l'écran.
  await page.locator("#mc-toggle").tap();
  await expect(page.locator("#mc-wrap")).not.toHaveClass(/collapsed/);
  const panel = await page.locator("#music-controls").boundingBox();
  expect(panel.y).toBeGreaterThanOrEqual(0);
  expect(panel.y + panel.height).toBeLessThanOrEqual(390);
});
