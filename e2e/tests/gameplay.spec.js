import { test, expect, canvasHelpers, collectErrors, gameState, reachBoss, screenText, skipHints, waitForMode } from "./helpers.js";

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

test("fin de partie sans serveur : classement annoncé injoignable, record personnel gardé, la seconde option mène au classement", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(async () => {
    const { PLAYER, BOSS } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    BOSS.bulletSpeed = 0; // seule la coque du boss peut toucher
  });

  // Requêtes vers l'API : coupées (un backend de développement peut tourner à
  // côté), mais elles partent, et le jeu doit s'en accommoder.
  await page.route("**/api/**", (route) => route.abort());
  const apiCalls = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) apiCalls.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });

  // Foncer dans la coque du boss : partie terminée, comptée, top consulté.
  await reachBoss(page, 2); // un kill avant le boss : un score nul n'interroge pas le classement
  await page.mouse.up();
  const { canvas, toPage, clickLogical } = canvasHelpers(page);
  const hull = await toPage((await gameState(page)).boss.weakPoints[0].x, 135);
  await page.mouse.move(hull.x, hull.y);
  await waitForMode(page, "game_over", 15000);
  await expect.poll(() => [...apiCalls].sort()).toEqual(["GET /api/scores", "POST /api/games"]);
  expect((await gameState(page)).scoreQualifies).toBe(false);
  await expect.poll(() => screenText(page)).toContain("CLASSEMENT INJOIGNABLE");
  // Premier score de ce navigateur : c'est le record personnel.
  const shown = await screenText(page);
  expect(shown).toContain("GAME OVER");
  expect(shown).toContain("NOUVEAU RECORD PERSONNEL !");
  expect(shown).not.toContain("ARME MASSIVE"); // la bannière de la vague ne reste pas figée sous GAME OVER
  const best = Number(await page.evaluate(() => localStorage.getItem("arcadepipe_best_score")));
  expect(best).toBeGreaterThan(0);
  await canvas.screenshot({ path: "test-results/game-over-offline.png" });

  // Seconde option : pas de saisie de pseudo, le classement directement.
  await clickLogical(240, 187.4);
  await waitForMode(page, "leaderboard");
  expect(apiCalls.filter((c) => c === "POST /api/scores")).toEqual([]);

  await expect.poll(() => screenText(page)).toContain("Classement indisponible");

  // Les requêtes coupées laissent un message réseau dans la console, pas une erreur JS.
  expect(errors.filter((e) => !e.includes("net::ERR_"))).toEqual([]);

  // Le record est gardé sur l'appareil : le menu l'affiche après un rechargement.
  await page.reload();
  await expect.poll(() => screenText(page)).toContain(`RECORD ${best}`);
});

test("serveur du classement lent : « … » pendant l'attente, puis « Chargement… », et REJOUER répond toujours", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(async () => {
    const { PLAYER, BOSS } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    BOSS.bulletSpeed = 0; // seule la coque du boss peut toucher
  });
  // Le classement répond au bout de 2,5 s, et répond qu'il est vide.
  await page.route("**/api/scores**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/games**", (route) => route.fulfill({ status: 201, json: { status: "ok" } }));

  const { toPage, clickLogical } = canvasHelpers(page);
  async function die() {
    await reachBoss(page, 2);
    await page.mouse.up();
    const hull = await toPage((await gameState(page)).boss.weakPoints[0].x, 135);
    await page.mouse.move(hull.x, hull.y);
    await waitForMode(page, "game_over", 15000);
  }

  // Seconde option choisie avant la réponse : l'écran montre qu'il attend, puis passe à la suite.
  await die();
  await clickLogical(240, 187.4);
  await expect.poll(() => screenText(page)).toContain("CLASSEMENT …");
  await waitForMode(page, "name_entry"); // classement vide : le score y entre

  // REJOUER, lui, n'attend pas le serveur.
  await page.reload();
  await skipHints(page);
  await page.evaluate(async () => {
    const { PLAYER, BOSS } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    BOSS.bulletSpeed = 0;
  });
  await die();
  await clickLogical(240, 167.4);
  await waitForMode(page, "playing", 1000);
});

test("classement ouvert depuis le menu : « Chargement… » tant que le serveur n'a pas répondu", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ json: [] });
  });
  await page.goto("/");
  const { clickLogical } = canvasHelpers(page);
  await clickLogical(240, 151.2 + 22); // CLASSEMENT
  await expect.poll(() => screenText(page)).toContain("Chargement…");
  await expect.poll(() => screenText(page), { timeout: 5000 }).toContain("Aucun score pour l'instant.");
});
