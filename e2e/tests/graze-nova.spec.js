// Graze (frôlement des tirs ennemis) + NOVA stockable : accumulation lente en
// conditions normales (il faut un ennemi qui tire, à portée) — on force un
// combat de boss dès la vague 1 (tire vite, garanti) et un rayon de
// frôlement/jauge généreux via import dynamique de config.js (voir helpers.js
// et powerups-boss.spec.js pour le même principe).
import { test, expect } from "@playwright/test";
import { canvasHelpers, collectErrors, skipHints } from "./helpers.js";

test("graze : la jauge NOVA se remplit et le bouton tactile apparaît", async ({ page }) => {
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
  await page.waitForTimeout(200);

  const novaBtn = page.locator("#nova-btn");
  await expect(novaBtn).not.toHaveClass(/hidden/, { timeout: 8000 });

  // Déclenchement : le stock repasse à 0 (baseMaxStock=1), le bouton redevient masqué.
  await novaBtn.click();
  await expect(novaBtn).toHaveClass(/hidden/, { timeout: 2000 });

  expect(errors).toEqual([]);
});
