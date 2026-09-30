// Bonus et combat de boss : trop lents à atteindre en conditions normales
// (taux de drop faible, plusieurs vagues avant le premier boss). Constantes
// forcées via un import dynamique de config.js (voir helpers.js) ; chaque
// test repart d'une page fraîche.
import { test, expect } from "@playwright/test";
import { canvasHelpers, collectErrors, gameState, skipHints } from "./helpers.js";

// Tire en balayant la hauteur jusqu'à un drop, puis va chercher le bonus au
// sol, jusqu'à ce que `picked(state)` soit vrai.
async function fireUntilPicked(page, picked) {
  const { toPage } = canvasHelpers(page);
  await page.mouse.down();
  for (let i = 0; i < 80; i++) {
    const s = await gameState(page);
    if (picked(s)) return s;
    const target = s.powerups.length ? s.powerups[0] : { x: 90, y: 30 + (i % 8) * 30 };
    const p = await toPage(target.x, target.y);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(250);
  }
  return gameState(page);
}

// 100 % de drop, un seul type de bonus, chute rapide et longue durée de vie :
// le bonus est au sol dès le premier kill et ne disparaît pas avant d'être ramassé.
async function forceDrops(page, weights) {
  await page.evaluate(async (w) => {
    const { POWERUP } = await import("/js/config.js");
    POWERUP.dropChanceNormal = 1;
    POWERUP.dropChanceElite = 1;
    POWERUP.fallSpeed = 60;
    POWERUP.lifetime = 60;
    POWERUP.typeWeights = w;
  }, weights);
}

test("un seul bonus à la fois : ramassé, puis aucun autre drop tant qu'il est actif", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  await forceDrops(page, { power: 1, rapid: 0, shotgun: 0, shield: 0 });

  const { canvas, startRun } = canvasHelpers(page);
  await startRun();

  const s = await fireUntilPicked(page, (st) => st.buff !== null);
  expect(s.buff).toBe("power");
  await canvas.screenshot({ path: "test-results/powerup-collected.png" });

  // Les kills continuent (tir maintenu, 100 % de drop) : aucun bonus ne doit
  // apparaître au sol tant que le premier est actif (resolveCollisions()).
  const { toPage } = canvasHelpers(page);
  for (let i = 0; i < 12; i++) {
    const p = await toPage(90, 30 + (i % 8) * 30);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(250);
    const st = await gameState(page);
    expect(st.buff).toBe("power");
    expect(st.powerups).toEqual([]);
  }

  await page.mouse.up();
  expect(errors).toEqual([]);
});

test("bouclier : ramassé, charges affichées, pas d'erreur", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  await forceDrops(page, { power: 0, rapid: 0, shotgun: 0, shield: 1 });

  const { canvas, startRun } = canvasHelpers(page);
  await startRun();

  const s = await fireUntilPicked(page, (st) => st.shield > 0);
  expect(s.shield).toBeGreaterThan(0);
  expect(s.buff).toBeNull(); // indépendant des bonus d'arme
  await canvas.screenshot({ path: "test-results/shield-active.png" });

  await page.mouse.up();
  expect(errors).toEqual([]);
});

test("premier combat de boss : coque + points faibles s'affichent, pas d'erreur", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);

  // Boss dès la vague 2 et 1 kill par vague : le combat arrive en quelques
  // secondes au lieu de plusieurs minutes.
  await page.evaluate(async () => {
    const { DIFFICULTY } = await import("/js/config.js");
    DIFFICULTY.bossWaveEvery = 2;
    DIFFICULTY.baseWaveKills = 1;
    DIFFICULTY.waveKillsStep = 0;
  });

  const { canvas, startRun, toPage } = canvasHelpers(page);
  await startRun();

  const ship = await toPage(90, 135);
  await page.mouse.move(ship.x, ship.y);
  await page.mouse.down();

  // Balaye la hauteur en tirant jusqu'au premier kill, donc jusqu'à la vague 2.
  const wave = async () => (await gameState(page)).wave;
  for (let i = 0; i < 40 && (await wave()) < 2; i++) {
    await page.mouse.move(ship.x, (await toPage(90, 30 + (i % 8) * 30)).y);
    await page.waitForTimeout(500);
  }
  expect(await wave()).toBe(2);

  // Tir maintenu, aligné sur un point faible pendant toute l'entrée : le boss
  // arrive intact, puis tire avant d'être détruit.
  const duringEntry = [];
  await expect.poll(async () => {
    const { boss } = await gameState(page);
    if (boss && !boss.arrived) {
      duringEntry.push(boss.weakPoints.length);
      await page.mouse.move(ship.x, (await toPage(90, boss.weakPoints[0].y)).y);
    }
    return boss?.arrived;
  }, { timeout: 5000, intervals: [100] }).toBe(true);
  await expect.poll(async () => (await gameState(page)).bossBullets, { timeout: 3000 }).toBeGreaterThan(0);
  expect((await gameState(page)).boss.weakPoints.length).toBeGreaterThan(0);
  expect(duringEntry.length).toBeGreaterThan(0);
  expect(duringEntry.every((n) => n === 4)).toBe(true); // 1er boss : BOSS.weakPointsMin points, aucun détruit pendant l'entrée
  await canvas.screenshot({ path: "test-results/boss-encounter.png" });

  await page.mouse.up();
  expect(errors).toEqual([]);
});
