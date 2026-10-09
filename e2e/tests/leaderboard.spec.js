// Classement avec le vrai backend (lancé par playwright.config.js sur le port
// 8001, base vide). Le jeu appelle le port 8000 en développement : ses requêtes
// sont redirigées ici vers ce backend de test.
import { test, expect } from "@playwright/test";
import { canvasHelpers, gameState, reachBoss, skipHints, waitForMode } from "./helpers.js";

const API = "http://localhost:8001";

test.skip(!process.env.E2E_BACKEND, "backend/venv absent : voir backend/README.md pour l'installer");

test.beforeEach(async ({ page }) => {
  await page.route("http://localhost:8000/api/**", (route) =>
    route.continue({ url: route.request().url().replace(":8000", ":8001") })
  );
});

const names = async (page) => ((await gameState(page)).scores || []).map((s) => s.player_name);

test("le classement affiche les scores du serveur, du meilleur au moins bon", async ({ page, request }) => {
  for (const [player_name, score] of [["ALPHA", 500], ["BETA", 900]]) {
    expect((await request.post(`${API}/api/scores`, { data: { player_name, score } })).status()).toBe(201);
  }
  await page.goto("/");
  const { clickLogical } = canvasHelpers(page);
  await clickLogical(240, 151.2 + 22); // CLASSEMENT
  await waitForMode(page, "leaderboard");
  await expect.poll(() => names(page)).toEqual(["BETA", "ALPHA"]);
});

test("fin de partie : pseudo tapé au clavier, validé par Entrée, score inscrit au classement", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(async () => {
    const { PLAYER, BOSS } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    BOSS.bulletSpeed = 0; // seule la coque du boss peut toucher
  });
  await reachBoss(page);
  await page.mouse.up();

  // Foncer dans la coque du boss : partie terminée.
  const { toPage, clickLogical } = canvasHelpers(page);
  const hull = await toPage((await gameState(page)).boss.weakPoints[0].x, 135);
  await page.mouse.move(hull.x, hull.y);
  await waitForMode(page, "game_over", 15000);

  // CLASSEMENT : le score entre dans le top (moins de dix scores), d'où la saisie du pseudo.
  await clickLogical(240, 187.4);
  await waitForMode(page, "name_entry");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace"); // efface "AAA"
  await page.keyboard.type("zoé 7"); // minuscules passées en majuscules, accent refusé
  await page.keyboard.press("Enter");
  await waitForMode(page, "leaderboard");

  await expect.poll(() => names(page)).toContain("ZO 7");
  expect((await gameState(page)).mode).toBe("leaderboard"); // l'Entrée de validation ne l'a pas refermé
});
