import { test, expect } from "@playwright/test";
import { canvasHelpers, collectErrors, gameState, skipHints, waitForMode } from "./helpers.js";

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

test("game over : REJOUER relance en un clic ; CLASSEMENT -> nom pré-rempli + VALIDER tactile (sans clavier)", async ({ page }) => {
  // Sur mobile, le clavier virtuel ne s'ouvre pas toujours : le pseudo est
  // pré-rempli (DEFAULT_NAME, states/endOfRun.js) et le bouton VALIDER permet
  // de valider au tap seul, ce que ce test vérifie.
  test.setTimeout(120000); // deux parties jusqu'au premier boss
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);

  // Mourir vite et à coup sûr : 1 vie, 1 kill par vague jusqu'au premier boss,
  // puis foncer dans sa coque (position connue, voir dieOnFirstBoss).
  await page.evaluate(async () => {
    const { PLAYER, DIFFICULTY } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    DIFFICULTY.baseWaveKills = 1;
    DIFFICULTY.waveKillsStep = 0;
  });

  // Requêtes vers l'API : coupées (un backend de développement peut tourner à
  // côté), mais elles partent, et le jeu doit s'en accommoder.
  await page.route("**/api/**", (route) => route.abort());
  const apiCalls = [];
  const postedNames = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) apiCalls.push(`${r.method()} ${new URL(r.url()).pathname}`);
    if (r.postData()) postedNames.push(JSON.parse(r.postData()).player_name);
  });

  const { canvas, startRun, toPage, clickLogical } = canvasHelpers(page);
  await startRun();
  await dieOnFirstBoss();
  await canvas.screenshot({ path: "test-results/name-entry-game-over.png" });

  // REJOUER (1re option) : nouvelle partie aussitôt, sans saisie du nom ; la
  // partie est comptée et le score envoyé en arrière-plan (voir replay()
  // dans states/endOfRun.js).
  await clickLogical(240, 167.4);
  await waitForMode(page, "playing");
  expect((await gameState(page)).wave).toBe(1);
  await expect.poll(() => apiCalls).toEqual(["POST /api/games", "GET /api/scores", "POST /api/scores"]);
  expect(postedNames).toEqual(["AAA"]); // aucun pseudo jamais saisi : nom par défaut

  await dieOnFirstBoss();

  // CLASSEMENT (2e option) : saisie du nom, le backend injoignable étant traité comme un score qui entre dans le top.
  await clickLogical(240, 187.4);
  await waitForMode(page, "name_entry");
  await canvas.screenshot({ path: "test-results/name-entry-prefilled.png" });

  // M est du texte pendant la saisie du pseudo : le son n'est pas coupé.
  await page.keyboard.type("é!"); // refusés : ne comptent pas dans les 8 caractères
  await page.keyboard.press("KeyM");
  await page.keyboard.press("KeyC");
  expect(await page.evaluate(async () => (await import("/js/main.js")).music.muted)).toBe(false);

  // Valide au tap uniquement (bouton VALIDER), jamais via le clavier caché.
  await clickLogical(240, 183.6);
  await waitForMode(page, "leaderboard");
  expect(postedNames).toEqual(["AAA", "AAAMC"]); // pseudo pré-rempli, plus les deux lettres tapées
  await canvas.screenshot({ path: "test-results/name-entry-validated.png" });

  // Les requêtes coupées laissent un message réseau dans la console, pas une erreur JS.
  const realErrors = errors.filter((e) => !e.includes("net::ERR_"));
  expect(realErrors).toEqual([]);

  async function dieOnFirstBoss() {
    // Tire en balayant la hauteur (1 kill par vague) jusqu'à l'arrivée du premier boss.
    await page.mouse.down();
    for (let i = 0; i < 150 && !(await gameState(page)).boss?.arrived; i++) {
      const p = await toPage(90, 30 + (i % 8) * 30);
      await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(300);
    }
    await page.mouse.up();
    expect((await gameState(page)).boss?.arrived).toBe(true);

    // Fonce dans la coque du boss : contact garanti (voir hitsBossHull dans boss.js).
    const { weakPoints } = (await gameState(page)).boss;
    const ram = await toPage(weakPoints[0].x, 135);
    await page.mouse.move(ram.x, ram.y);
    await waitForMode(page, "game_over", 15000);
  }
});
