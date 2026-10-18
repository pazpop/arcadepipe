// Graze (frôlement des tirs ennemis) + NOVA stockable : accumulation lente en
// conditions normales (il faut un ennemi qui tire, à portée) — on force un
// combat de boss dès la vague 1 (tire vite, garanti) et un rayon de
// frôlement/jauge généreux via import dynamique de config.js (voir helpers.js
// et powerups-boss.spec.js pour le même principe).
import { test, expect, canvasHelpers, collectErrors, gameState, skipHints } from "./helpers.js";

test("graze : la jauge NOVA se remplit, le bouton tactile apparaît et NOVA efface les tirs", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);

  await page.evaluate(async () => {
    const { DIFFICULTY, GRAZE } = await import("/js/config.js");
    DIFFICULTY.bossWaveEvery = 1; // vague 1 = combat de boss -> tire vite, sans dépendre du tirage élite/gunner
    GRAZE.radius = 999; // couvre tout l'écran : le premier tir ennemi graze forcément
    GRAZE.grazePerCharge = 1; // un seul graze suffit à remplir la jauge
  });

  const { startRun } = canvasHelpers(page);
  await startRun();

  const novaBtn = page.locator("#nova-btn");
  await expect(novaBtn).not.toHaveClass(/hidden/, { timeout: 8000 });

  // La jauge ne doit plus se recharger : sinon la salve suivante du boss
  // rendrait la charge (et le bouton) aussitôt.
  await page.evaluate(async () => {
    const { GRAZE } = await import("/js/config.js");
    GRAZE.grazePerCharge = 1000;
  });
  await expect.poll(async () => (await gameState(page)).bossBullets).toBeGreaterThan(0);

  // Déclenchement : les tirs du boss disparaissent (regardé à chaque image,
  // avant sa salve suivante), le stock repasse à 0 et le bouton est masqué.
  await novaBtn.click();
  const cleared = await page.evaluate(async () => {
    const { game } = await import("/js/main.js");
    for (let frame = 0; frame < 120; frame++) {
      if (game.bossBulletsOnScreen === 0) return true;
      await new Promise(requestAnimationFrame);
    }
    return false;
  });
  expect(cleared).toBe(true);
  await expect(novaBtn).toHaveClass(/hidden/, { timeout: 2000 });

  expect(errors).toEqual([]);
});

test("NOVA au clavier : Espace détruit les ennemis à l'écran", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(() => localStorage.setItem("arcadepipe_autofire", "0")); // aucun tir : seul NOVA peut abattre un ennemi
  await page.reload();
  await page.evaluate(async () => {
    const { GRAZE } = await import("/js/config.js");
    GRAZE.radius = 999; // le premier ennemi à l'écran est aussitôt "frôlé"
    GRAZE.grazePerCharge = 1; // un frôlement = une charge
  });
  const { startRun, moveLogical } = canvasHelpers(page);
  await startRun();
  await moveLogical(60, 135); // loin de la zone d'apparition des ennemis

  await expect(page.locator("#nova-btn")).not.toHaveClass(/hidden/, { timeout: 10000 });
  expect((await gameState(page)).kills).toBe(0);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await gameState(page)).kills).toBeGreaterThan(0);
  expect((await gameState(page)).playerBullets).toBe(0);
});
