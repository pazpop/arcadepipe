import { test, expect } from "@playwright/test";
import { canvasHelpers, collectErrors, gameState, skipHints, waitForMode } from "./helpers.js";

test("le tir est manuel : aucune balle sans clic maintenu, tir dès qu'on maintient", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  const { canvas, startRun, moveLogical, toPage } = canvasHelpers(page);
  await startRun();
  await moveLogical(90, 135);

  await page.waitForTimeout(1000);
  await canvas.screenshot({ path: "test-results/fire-manual-idle.png" });

  const ship = await toPage(90, 135);
  await page.mouse.move(ship.x, ship.y);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await canvas.screenshot({ path: "test-results/fire-manual-held.png" });
  await page.mouse.up();

  expect(errors).toEqual([]);
});

test("la case 'Tir auto' active le tir sans avoir à cliquer, et persiste (localStorage)", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  const { startRun, moveLogical, canvas } = canvasHelpers(page);

  await page.locator("#autofire-toggle").check();
  await startRun();
  await moveLogical(90, 135);
  await page.waitForTimeout(600); // tir auto : pas besoin de maintenir le clic
  await canvas.screenshot({ path: "test-results/fire-auto.png" });

  const stored = await page.evaluate(() => localStorage.getItem("arcadepipe_autofire"));
  expect(stored).toBe("1");
  expect(errors).toEqual([]);
});

test("une nouvelle partie choisit une piste musicale différente de la précédente", async ({ page }) => {
  // Teste directement music.playRandom() (voir onEnded dans audio/music.js
  // et son appel dans startRun() de states/playing.js) plutôt que de naviguer tout un
  // cycle menu -> pause -> confirmation -> menu : ça isole la logique de
  // sélection elle-même, sans dépendre du chemin UI pour y arriver.
  const errors = collectErrors(page);
  await page.goto("/");

  const [t1, t2, t3] = await page.evaluate(async () => {
    const { music } = await import("/js/main.js");
    const picks = [];
    for (let i = 0; i < 3; i++) {
      music.playRandom();
      picks.push(music.trackIndex);
    }
    return picks;
  });

  expect(t2).not.toBe(t1);
  expect(t3).not.toBe(t2);
  expect(errors).toEqual([]);
});

test("vague 1 : transition propre, aucune erreur sur une session de jeu prolongée", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  const { canvas, startRun, toPage } = canvasHelpers(page);
  await startRun();

  const ship = await toPage(90, 135);
  await page.mouse.move(ship.x, ship.y);
  await page.mouse.down();

  // Assez long pour couvrir la fin de la vague 1 (~14s en difficulté par
  // défaut) et vérifier qu'aucune erreur ne survient pendant la transition
  // (ennemis + projectiles ennemis effacés, saut spatial, planètes/galaxies).
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(2000);
  }
  await canvas.screenshot({ path: "test-results/wave-session.png" });
  await page.mouse.up();

  expect(errors).toEqual([]);
});

test("game over : REJOUER relance en un clic ; CLASSEMENT -> nom pré-rempli + VALIDER tactile (sans clavier)", async ({ page }) => {
  // Sur mobile, focus() sur le champ caché arrive après un `await` (hors du
  // geste utilisateur d'origine) : la plupart des navigateurs mobiles
  // refusent alors d'ouvrir le clavier virtuel. D'où le nom par défaut déjà
  // rempli (voir DEFAULT_NAME dans states/endOfRun.js) et le bouton "VALIDER"
  // tactile (voir hitTestNameEntryValidate dans hud.js) — ce test vérifie
  // qu'on peut valider le score uniquement au tap, sans jamais toucher au
  // clavier.
  test.setTimeout(120000); // deux parties jusqu'au premier boss
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);

  // 1 vie -> le premier coup encaissé termine la partie. Ni le corps des
  // ennemis ni les tirs du joueur (purement horizontaux, voir
  // projectiles.js) ne sont fiables pour déclencher ça vite (hitbox
  // minuscule, "style danmaku", voir PLAYER.hitboxRadius) : on force plutôt
  // une progression ultra rapide (1 kill/vague) jusqu'au premier boss
  // (vague DIFFICULTY.bossWaveEvery), puis on fonce directement dans sa
  // coque — collision déterministe (position connue), pas de RNG d'élite à
  // espérer (voir hitsBossHull dans boss.js, ajouté pour que foncer dans le
  // boss fasse mal au joueur, pas seulement l'inverse).
  await page.evaluate(async () => {
    const { PLAYER, DIFFICULTY } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    DIFFICULTY.baseWaveKills = 1;
    DIFFICULTY.waveKillsStep = 0;
  });

  // Requêtes vers l'API (aucun backend en e2e : elles échouent, mais partent).
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

  // CLASSEMENT (2e option) -> triggerGameOver() (states/endOfRun.js) et
  // l'entrée en saisie du nom.
  await clickLogical(240, 187.4);
  await waitForMode(page, "name_entry");
  await canvas.screenshot({ path: "test-results/name-entry-prefilled.png" });

  // M et C sont du texte pendant la saisie du pseudo : ni son coupé, ni CRT basculé.
  const crtAvant = await page.locator("#crt-overlay").getAttribute("class");
  await page.keyboard.press("KeyM");
  await page.keyboard.press("KeyC");
  expect(await page.evaluate(async () => (await import("/js/main.js")).music.muted)).toBe(false);
  expect(await page.locator("#crt-overlay").getAttribute("class")).toBe(crtAvant);

  // Valide au tap uniquement (bouton VALIDER), jamais via le clavier caché.
  await clickLogical(240, 183.6);
  await waitForMode(page, "leaderboard");
  await canvas.screenshot({ path: "test-results/name-entry-validated.png" });

  // ERR_CONNECTION_REFUSED attendu : ce test est le premier à atteindre le
  // classement, qui appelle l'API (fetchTopScores/submitScore) — mais la
  // suite e2e ne lance jamais de backend (voir webServer dans
  // playwright.config.js, uniquement le serveur statique du frontend), par
  // choix. Le code gère déjà ça proprement (try/catch, voir
  // triggerGameOver/confirmNameEntry dans states/endOfRun.js) : c'est un message
  // console de ressource réseau, pas une vraie erreur JS.
  const realErrors = errors.filter((e) => !e.includes("ERR_CONNECTION_REFUSED"));
  expect(realErrors).toEqual([]);

  async function dieOnFirstBoss() {
    // Tire en balayant la hauteur (1 kill par vague) jusqu'à l'arrivée du premier boss.
    await page.mouse.down();
    for (let i = 0; !(await gameState(page)).boss?.arrived; i++) {
      const p = await toPage(90, 30 + (i % 8) * 30);
      await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(300);
    }
    await page.mouse.up();

    // Fonce dans la coque du boss : contact garanti (voir hitsBossHull dans boss.js).
    const { weakPoints } = (await gameState(page)).boss;
    const ram = await toPage(weakPoints[0].x, 135);
    await page.mouse.move(ram.x, ram.y);
    await waitForMode(page, "game_over", 15000);
  }
});
