// Niveau bonus (bonusLevel.js) : trop lent à atteindre en conditions
// normales (il faut un score conséquent avant la vague 10) — vagues
// accélérées via import dynamique de config.js (voir helpers.js et
// powerups-boss.spec.js pour le même principe).
import { test, expect, canvasHelpers, collectErrors, gameState, skipHints } from "./helpers.js";

test("niveau bonus : se déclenche avant la vague 10, se termine, puis la partie reprend", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);

  await page.evaluate(async () => {
    const { DIFFICULTY, BONUS_LEVEL } = await import("/js/config.js");
    DIFFICULTY.baseWaveKills = 0; // vague "terminée" dès son démarrage
    DIFFICULTY.waveKillsStep = 0;
    DIFFICULTY.waveBreakDuration = 0.3;
    DIFFICULTY.bossWaveEvery = 999; // pas de combat de boss pour ce test
    BONUS_LEVEL.firstScoreThreshold = 0;
    BONUS_LEVEL.ringCount = 3; // niveau court
    BONUS_LEVEL.introDuration = 0.5;
  });

  const { startRun } = canvasHelpers(page);
  await startRun();

  // Vagues 1-9 quasi instantanées (0 kill requis/vague) -> niveau bonus juste avant la vague 10.
  const inBonus = async () => (await gameState(page)).inBonusLevel;
  await expect.poll(inBonus, { timeout: 20000 }).toBe(true);
  expect((await gameState(page)).wave).toBe(9);
  await page.screenshot({ path: "test-results/bonus-level-active.png" });

  // Fin du niveau (intro, puis 3 anneaux à 1,3 s d'intervalle), puis la partie reprend.
  await expect.poll(inBonus, { timeout: 25000 }).toBe(false);
  await expect.poll(async () => (await gameState(page)).wave).toBeGreaterThanOrEqual(10);
  await page.screenshot({ path: "test-results/bonus-level-reward.png" });

  expect(errors).toEqual([]);
});
