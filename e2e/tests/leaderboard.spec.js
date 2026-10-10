// Classement avec le vrai backend (lancé par playwright.config.js sur le port
// 8001, base vide). Le jeu appelle le port 8000 en développement : ses requêtes
// sont redirigées ici vers ce backend de test.
import { test, expect, canvasHelpers, gameState, reachBoss, screenText, skipHints, waitForMode } from "./helpers.js";

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
    // Autre adresse IP que celle du jeu : ces deux envois ne comptent pas dans
    // son quota de cinq scores par minute, entamé par le test suivant.
    const headers = { "X-Forwarded-For": "203.0.113.9" };
    expect((await request.post(`${API}/api/scores`, { data: { player_name, score }, headers })).status()).toBe(201);
  }
  await page.goto("/");
  const { clickLogical } = canvasHelpers(page);
  await clickLogical(240, 151.2 + 22); // CLASSEMENT
  await waitForMode(page, "leaderboard");
  // Les deux scores sont là, le meilleur devant.
  const order = async () => (await names(page)).filter((n) => n === "ALPHA" || n === "BETA").slice(0, 2);
  await expect.poll(order).toEqual(["BETA", "ALPHA"]);
});

test("fin de partie : top annoncé ; score inscrit en rejouant, au tap sur VALIDER, puis au clavier", async ({ page, request }) => {
  test.setTimeout(120000); // trois parties jusqu'au premier boss
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(async () => {
    const { PLAYER, BOSS } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    BOSS.bulletSpeed = 0; // seule la coque du boss peut toucher
  });
  const { toPage, clickLogical } = canvasHelpers(page);
  const serverNames = async () => (await (await request.get(`${API}/api/scores?limit=100`)).json()).map((s) => s.player_name);

  // Joue jusqu'au boss, fonce dans sa coque, et attend l'annonce du top (moins de dix scores en base).
  async function dieAndQualify() {
    await reachBoss(page, 2); // un kill avant le boss : un score nul n'entre pas au classement
    await page.mouse.up();
    const hull = await toPage((await gameState(page)).boss.weakPoints[0].x, 135);
    await page.mouse.move(hull.x, hull.y);
    await waitForMode(page, "game_over", 15000);
    await expect.poll(() => screenText(page)).toContain("TU ENTRES DANS LE TOP 10 !");
    expect(await screenText(page)).toContain("ENTRER MON PSEUDO");
  }

  // 1. REJOUER : nouvelle partie aussitôt, score envoyé en arrière-plan sous le pseudo par défaut.
  await dieAndQualify();
  await clickLogical(240, 167.4);
  await waitForMode(page, "playing");
  await expect.poll(serverNames).toContain("AAA");

  // 2. ENTRER MON PSEUDO, validé au tap sur VALIDER sans rien taper (téléphone sans clavier).
  await dieAndQualify();
  await clickLogical(240, 187.4);
  await waitForMode(page, "name_entry");
  // L'envoi du score ne part que lorsque le test le décide : l'écran montre qu'il attend.
  let send;
  const sent = new Promise((resolve) => (send = resolve));
  await page.route("http://localhost:8000/api/scores", async (route) => {
    if (route.request().method() === "POST") await sent;
    await route.fallback();
  });
  await clickLogical(240, 118); // VALIDER
  await expect.poll(() => screenText(page)).toContain("VALIDER …");
  send();
  await waitForMode(page, "leaderboard");
  await expect.poll(async () => (await serverNames()).filter((n) => n === "AAA").length).toBe(2);
  await clickLogical(240, 135); // retour au menu

  // 3. ENTRER MON PSEUDO, tapé au clavier et validé par Entrée.
  await waitForMode(page, "menu");
  await dieAndQualify();
  await clickLogical(240, 187.4);
  await waitForMode(page, "name_entry");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace"); // efface "AAA"
  await page.keyboard.press("Tab"); // ne quitte pas le champ : la suite s'y écrit encore
  await page.keyboard.type("zoé m7"); // minuscules passées en majuscules, accent refusé
  expect(await page.evaluate(async () => (await import("/js/main.js")).music.muted)).toBe(false); // M est du texte ici
  await page.keyboard.press("Enter");
  await waitForMode(page, "leaderboard");
  await expect.poll(() => names(page)).toContain("ZO M7");
  expect((await gameState(page)).mode).toBe("leaderboard"); // l'Entrée de validation ne l'a pas refermé
});
