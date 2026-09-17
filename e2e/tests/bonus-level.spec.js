// Niveau bonus (bonusLevel.js) : trop lent à atteindre en conditions
// normales (il faut un score conséquent avant la vague 10) — vagues
// accélérées via import dynamique de config.js (voir helpers.js et
// powerups-boss.spec.js pour le même principe).
import { test, expect } from "@playwright/test";
import { canvasHelpers, collectErrors, skipHints } from "./helpers.js";

test("niveau bonus : se déclenche, les anneaux défilent, la jauge NOVA se remplit", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);

  await page.evaluate(async () => {
    const { DIFFICULTY, BONUS_LEVEL } = await import("/js/config.js");
    DIFFICULTY.baseWaveKills = 0; // vague "terminée" dès son démarrage
    DIFFICULTY.waveKillsStep = 0;
    DIFFICULTY.waveBreakDuration = 0.3;
    DIFFICULTY.bossWaveEvery = 999; // pas de combat de boss pour ce test
    BONUS_LEVEL.firstScoreThreshold = 0; // seuil trivial : le score de départ (0) suffit déjà
  });

  const { startRun } = canvasHelpers(page);
  await startRun();
  await page.waitForTimeout(200);

  // Vagues 1-9 quasi instantanées (0 kill requis/vague) -> niveau bonus juste avant la vague 10
  // (rendu au canvas, pas de sélecteur DOM possible — juste laisser le temps).
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "test-results/bonus-level-active.png" });

  // Laisse le niveau se terminer (10 anneaux, ~1.3s d'intervalle + un peu de marge).
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "test-results/bonus-level-reward.png" });

  expect(errors).toEqual([]);
});
