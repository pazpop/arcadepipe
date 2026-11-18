import { test, expect, canvasHelpers, collectErrors, dieOnBossHull, gameState, reachBoss, screenText, skipHints, waitForMode } from "./helpers.js";

test("tir automatique par défaut : le vaisseau tire sans clic", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  await expect(page.locator("#autofire-toggle")).toBeChecked();
  const { startRun, moveLogical } = canvasHelpers(page);
  await startRun();
  await moveLogical(90, 135);
  await expect.poll(async () => (await gameState(page)).playerBullets).toBeGreaterThan(0);
});

test("tir automatique décoché : aucun tir sans clic maintenu, et le choix tient au rechargement", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  await page.locator("#autofire-toggle").uncheck();
  const { startRun, moveLogical } = canvasHelpers(page);
  await startRun();
  await moveLogical(90, 135);

  // Glissée d'entrée terminée (1,8 s, pendant laquelle aucun tir n'est possible),
  // puis une seconde sans cliquer : toujours aucun tir.
  await page.waitForTimeout(3000);
  expect((await gameState(page)).playerBullets).toBe(0);

  await page.mouse.down();
  await expect.poll(async () => (await gameState(page)).playerBullets).toBeGreaterThan(0);
  await page.mouse.up();

  await page.reload();
  await expect(page.locator("#autofire-toggle")).not.toBeChecked();
  expect(errors).toEqual([]);
});

test("playRandom ne rejoue jamais la même piste deux fois de suite", async ({ page }) => {
  await page.goto("/");
  const picks = await page.evaluate(async () => {
    const { music } = await import("/js/main.js");
    return Array.from({ length: 12 }, () => {
      music.playRandom();
      return music.trackIndex;
    });
  });
  for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
});

const trackIndex = (page) => page.evaluate(async () => (await import("/js/main.js")).music.trackIndex);

test("musique : une nouvelle partie garde le morceau en cours", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  const { clickLogical, startRun } = canvasHelpers(page);
  await clickLogical(240, 20); // premier geste, hors des options : la musique démarre
  const before = await trackIndex(page);
  await startRun();
  expect(await trackIndex(page)).toBe(before);
});

test("musique : une visite ne recommence pas par le dernier morceau entendu", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("arcadepipe_track", "2"));
  await page.reload();
  await canvasHelpers(page).clickLogical(240, 20); // premier geste : la musique démarre
  expect(await trackIndex(page)).not.toBe(2);
});

test("fin de vague : la vague 2 démarre après le saut spatial, sans erreur", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(async () => {
    const { DIFFICULTY } = await import("/js/config.js");
    DIFFICULTY.baseWaveKills = 1; // un seul ennemi à abattre
  });
  const { canvas, startRun, toPage } = canvasHelpers(page);
  await startRun();

  // Tire en balayant la hauteur jusqu'à la vague 2.
  await page.mouse.down();
  for (let i = 0; i < 100 && (await gameState(page)).wave < 2; i++) {
    const p = await toPage(90, 30 + (i % 8) * 30);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(300);
  }
  await page.mouse.up();
  expect((await gameState(page)).wave).toBe(2);
  await canvas.screenshot({ path: "test-results/wave-2.png" });
  expect(errors).toEqual([]);
});

test("fin de partie : partie comptée, top annoncé, record personnel gardé", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(async () => {
    const { PLAYER, BOSS } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    BOSS.bulletSpeed = 0; // seule la coque du boss peut toucher
  });

  // Foncer dans la coque du boss : partie terminée et comptée ; classement vide de ce navigateur, le score y entre.
  await dieOnBossHull(page); // score non nul : un score nul n'entre pas au classement
  const { canvas } = canvasHelpers(page);
  expect((await gameState(page)).scoreQualifies).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("arcadepipe_games_played"))).toBe("1");
  // L'écran de fin est dessiné à l'image suivante : l'attendre avant de le lire. Premier score de ce navigateur :
  // c'est le record personnel.
  await expect.poll(() => screenText(page)).toContain("TU ENTRES DANS LE TOP 10 !");
  const shown = await screenText(page);
  expect(shown).toContain("GAME OVER");
  expect(shown).toContain("NOUVEAU RECORD PERSONNEL !");
  expect(shown).not.toContain("ARME MASSIVE"); // la bannière de la vague ne reste pas figée sous GAME OVER
  expect(shown).not.toContain("INTACT"); // ni le rappel du bonus sans dégâts, qui clignote au premier coup de la vague
  const best = Number(await page.evaluate(() => localStorage.getItem("arcadepipe_best_score")));
  expect(best).toBeGreaterThan(0);
  await canvas.screenshot({ path: "test-results/game-over.png" });
  expect(errors).toEqual([]);

  // Le record est gardé sur l'appareil : le menu l'affiche après un rechargement.
  await page.reload();
  await expect.poll(() => screenText(page)).toContain(`RECORD ${best}`);
});

test("partie quittée par le menu de pause : le record personnel n'est pas enregistré", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  await reachBoss(page, 2); // un ennemi abattu : le score n'est plus nul
  await page.mouse.up();
  const { clickLogical } = canvasHelpers(page);
  await page.keyboard.press("KeyP");
  await waitForMode(page, "paused");
  await clickLogical(240, 172); // MENU PRINCIPAL
  await clickLogical(240, 158); // OUI, QUITTER
  await waitForMode(page, "menu");
  expect(await page.evaluate(() => localStorage.getItem("arcadepipe_best_score"))).toBeNull();
  await expect.poll(() => screenText(page)).toContain("JOUER"); // le menu est dessiné
  expect(await screenText(page)).not.toContain("RECORD");
});
