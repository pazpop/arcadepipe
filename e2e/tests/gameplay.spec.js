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
  await dieOnBossHull(page); // score non nul : un score nul n'interroge pas le classement
  const { canvas, clickLogical } = canvasHelpers(page);
  await expect.poll(() => [...apiCalls].sort()).toEqual(["GET /api/scores", "POST /api/games"]);
  expect((await gameState(page)).scoreQualifies).toBe(false);
  await expect.poll(() => screenText(page)).toContain("CLASSEMENT INJOIGNABLE");
  // Premier score de ce navigateur : c'est le record personnel.
  const shown = await screenText(page);
  expect(shown).toContain("GAME OVER");
  expect(shown).toContain("NOUVEAU RECORD PERSONNEL !");
  expect(shown).not.toContain("ARME MASSIVE"); // la bannière de la vague ne reste pas figée sous GAME OVER
  expect(shown).not.toContain("INTACT"); // ni le rappel du bonus sans dégâts, qui clignote au premier coup de la vague
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

// Partie perdue contre la coque du boss, avec un classement qui ne répond (qu'il
// est vide) que lorsque le test appelle la fonction renvoyée.
async function dieWithSlowLeaderboard(page) {
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(async () => {
    const { PLAYER, BOSS } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    BOSS.bulletSpeed = 0; // seule la coque du boss peut toucher
  });
  let answer;
  const answered = new Promise((resolve) => (answer = resolve));
  await page.route("**/api/scores**", async (route) => {
    await answered;
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/games**", (route) => route.fulfill({ status: 201, json: { status: "ok" } }));

  await dieOnBossHull(page);
  return answer;
}

test("serveur du classement lent : la seconde option affiche « … » pendant l'attente, puis passe à la suite", async ({ page }) => {
  const answer = await dieWithSlowLeaderboard(page);
  const { clickLogical } = canvasHelpers(page);
  await clickLogical(240, 187.4);
  await expect.poll(() => screenText(page)).toContain("CLASSEMENT …");
  answer();
  await waitForMode(page, "name_entry"); // classement vide : le score y entre
});

test("serveur du classement lent : REJOUER n'attend pas sa réponse", async ({ page }) => {
  const answer = await dieWithSlowLeaderboard(page);
  const { clickLogical } = canvasHelpers(page);
  await clickLogical(240, 167.4);
  await waitForMode(page, "playing", 1000);
  answer();
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

// Partie perdue avec un classement vide (le score y entre) ; l'envoi du score est refusé (422).
async function dieWithRefusedScore(page) {
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(async () => {
    const { PLAYER, BOSS } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    BOSS.bulletSpeed = 0; // seule la coque du boss peut toucher
  });
  await page.route("**/api/scores**", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 422, json: { detail: "invalid request" } })
      : route.fulfill({ json: [] })
  );
  await page.route("**/api/games**", (route) => route.fulfill({ status: 201, json: { count: 1 } }));
  await dieOnBossHull(page);
  await expect.poll(async () => (await gameState(page)).scoreQualifies).toBe(true);
}

test("score refusé par le serveur, pseudo validé : le classement dit que le score n'est pas envoyé", async ({ page }) => {
  await dieWithRefusedScore(page);
  const { clickLogical } = canvasHelpers(page);
  await clickLogical(240, 187.4); // ENTRER MON PSEUDO
  await waitForMode(page, "name_entry");
  await clickLogical(240, 118); // VALIDER
  await waitForMode(page, "leaderboard");
  await expect.poll(() => screenText(page)).toContain("SCORE NON ENVOYÉ");
  // Rouvert depuis le menu, le classement n'en parle plus.
  await clickLogical(240, 135);
  await waitForMode(page, "menu");
  await clickLogical(240, 151.2 + 22); // CLASSEMENT
  await waitForMode(page, "leaderboard");
  await expect.poll(() => screenText(page)).toContain("Aucun score pour l'instant.");
  expect(await screenText(page)).not.toContain("SCORE NON ENVOYÉ");
});

test("score refusé par le serveur, REJOUER : une bannière le dit dans la partie suivante", async ({ page }) => {
  await dieWithRefusedScore(page);
  const { clickLogical } = canvasHelpers(page);
  await clickLogical(240, 167.4); // REJOUER
  await waitForMode(page, "playing");
  await expect.poll(() => screenText(page)).toContain("SCORE NON ENVOYÉ");
});

test("un ancien choix « classement » en attente n'ouvre pas la saisie du pseudo d'une autre partie", async ({ page }) => {
  test.setTimeout(120000); // deux parties jusqu'au boss
  // Requêtes jamais abandonnées (5 s, api.js) : la réponse attendue par la
  // première partie peut arriver après la fin de la seconde, comme sur un réseau
  // très lent avec deux parties courtes.
  await page.addInitScript(() => {
    AbortController.prototype.abort = () => {};
  });
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(async () => {
    const { PLAYER, BOSS } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    BOSS.bulletSpeed = 0; // seule la coque du boss peut toucher
  });
  // Le classement de la première partie ne répond (vide : son score y entre)
  // que lorsque le test le décide ; celui de la seconde ne répond jamais.
  let answerFirst;
  const firstAnswered = new Promise((resolve) => (answerFirst = resolve));
  let gets = 0;
  await page.route("**/api/scores**", async (route) => {
    if (++gets === 1) {
      await firstAnswered;
      await route.fulfill({ json: [] });
    }
  });
  await page.route("**/api/games**", (route) => route.fulfill({ status: 201, json: { count: 1 } }));
  const { clickLogical } = canvasHelpers(page);

  await dieOnBossHull(page);
  await clickLogical(240, 187.4); // classement : attend la réponse
  await expect.poll(() => screenText(page)).toContain("CLASSEMENT …");
  await clickLogical(240, 167.4); // REJOUER avant la réponse
  await waitForMode(page, "playing");
  await dieOnBossHull(page); // seconde fin de partie
  answerFirst();
  await page.waitForTimeout(500);
  expect((await gameState(page)).mode).toBe("game_over");
});

test("classement rouvert : l'ancien nombre de parties ne s'affiche pas pendant le chargement", async ({ page }) => {
  let count = 7;
  let slow = false;
  await page.route("**/api/scores**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/games**", async (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 201, json: { status: "ok" } });
    if (slow) await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ json: { count } });
  });
  await page.goto("/");
  const { clickLogical } = canvasHelpers(page);
  await clickLogical(240, 151.2 + 22); // CLASSEMENT
  await expect.poll(() => screenText(page)).toContain("PARTIES JOUÉES : 7");
  await clickLogical(240, 135); // retour au menu
  await waitForMode(page, "menu");
  // Une partie comptée vide le cache du compteur : le classement le redemande, lentement.
  count = 8;
  slow = true;
  await page.evaluate(async () => (await import("/js/api.js")).recordGamePlayed());
  await clickLogical(240, 151.2 + 22);
  await waitForMode(page, "leaderboard");
  await page.waitForTimeout(300);
  expect(await screenText(page)).not.toContain("PARTIES JOUÉES : 7");
  await expect.poll(() => screenText(page), { timeout: 5000 }).toContain("PARTIES JOUÉES : 8");
});
