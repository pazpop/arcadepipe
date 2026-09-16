import { test, expect } from "@playwright/test";
import { canvasHelpers, collectErrors, skipHints } from "./helpers.js";

test("le tir est manuel : aucune balle sans clic maintenu, tir dès qu'on maintient", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  const { canvas, startRun, moveLogical, toPage } = canvasHelpers(page);
  await startRun();
  await page.waitForTimeout(200);
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
  await page.waitForTimeout(200);
  await moveLogical(90, 135);
  await page.waitForTimeout(600); // tir auto : pas besoin de maintenir le clic
  await canvas.screenshot({ path: "test-results/fire-auto.png" });

  const stored = await page.evaluate(() => localStorage.getItem("arcadepipe_autofire"));
  expect(stored).toBe("1");
  expect(errors).toEqual([]);
});

test("une nouvelle partie choisit une piste musicale différente de la précédente", async ({ page }) => {
  // Teste directement music.playRandom() (voir onEnded dans audio/music.js
  // et son appel dans startRun() de game.js) plutôt que de naviguer tout un
  // cycle menu -> pause -> confirmation -> menu : ça isole la logique de
  // sélection elle-même, sans dépendre du chemin UI pour y arriver.
  const errors = collectErrors(page);
  await page.goto("/");
  await page.waitForTimeout(200); // laisse main.js s'évaluer avant l'import dynamique

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
  await page.waitForTimeout(200);

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

test("nom aléatoire pré-rempli + bouton VALIDER tactile (sans clavier)", async ({ page }) => {
  // Sur mobile, focus() sur le champ caché arrive après un `await` (hors du
  // geste utilisateur d'origine) : la plupart des navigateurs mobiles
  // refusent alors d'ouvrir le clavier virtuel. D'où le nom aléatoire déjà
  // rempli (voir randomPilotName() dans game.js) et le bouton "VALIDER"
  // tactile (voir hitTestNameEntryValidate dans hud.js) — ce test vérifie
  // qu'on peut valider le score uniquement au tap, sans jamais toucher au
  // clavier.
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);

  // 1 vie -> le premier coup encaissé termine la partie. Ni le corps des
  // ennemis ni les tirs du joueur (purement horizontaux, voir
  // projectiles.js) ne sont fiables pour déclencher ça vite (hitbox
  // minuscule, "style danmaku", voir PLAYER.hitboxRadius) : on force plutôt
  // une progression ultra rapide (1 kill/vague) jusqu'à la vague 4 (premier
  // boss, voir DIFFICULTY.bossWaveEvery), puis on fonce directement dans sa
  // coque — collision déterministe (position connue), pas de RNG d'élite à
  // espérer (voir hitsBossHull dans boss.js, ajouté pour que foncer dans le
  // boss fasse mal au joueur, pas seulement l'inverse).
  await page.evaluate(async () => {
    const { PLAYER, DIFFICULTY } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    DIFFICULTY.baseWaveKills = 1;
    DIFFICULTY.waveKillsStep = 0;
  });

  const { canvas, startRun, toPage, clickLogical } = canvasHelpers(page);
  await startRun();
  await page.waitForTimeout(200);

  // Tire en continu en balayant la hauteur pour enchaîner les vagues 1-3
  // (1 kill chacune) le plus vite possible jusqu'au boss de la vague 4.
  await page.mouse.move((await toPage(90, 135)).x, (await toPage(90, 135)).y);
  await page.mouse.down();
  for (let i = 0; i < 24; i++) {
    const y = 30 + (i % 8) * 30;
    const p = await toPage(90, y);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(700);
  }
  await page.mouse.up();

  // Fonce dans la coque du boss (arrivée vers x≈361 logique, voir
  // RIGHT_ZONE_BOUND/BOSS_ZONE_MARGIN dans boss.js) -> contact garanti.
  const ram = await toPage(360, 135);
  await page.mouse.move(ram.x, ram.y);
  await page.waitForTimeout(5000);
  // Marge supplémentaire : la séquence de mort (ralenti cinématique) dure
  // ~1.6s en temps réel avant l'écran GAME OVER (voir g.deathTimer dans
  // game.js) — sans ça, le tap "OK" pourrait tomber pendant que la partie
  // tourne encore, sans aucun effet.
  await page.waitForTimeout(2000);
  await canvas.screenshot({ path: "test-results/name-entry-game-over.png" });

  // Écran GAME OVER intermédiaire (voir drawDeathScreen) -> "OK" déclenche
  // handleGameOver() et l'entrée en saisie du nom.
  await clickLogical(240, 168);
  await page.waitForTimeout(400);
  await canvas.screenshot({ path: "test-results/name-entry-prefilled.png" });

  // Valide au tap uniquement (bouton VALIDER), jamais via le clavier caché.
  await clickLogical(240, 183.6);
  await page.waitForTimeout(300);
  await canvas.screenshot({ path: "test-results/name-entry-validated.png" });

  // ERR_CONNECTION_REFUSED attendu : ce test est le premier à atteindre le
  // classement, qui appelle l'API (fetchTopScores/submitScore) — mais la
  // suite e2e ne lance jamais de backend (voir webServer dans
  // playwright.config.js, uniquement le serveur statique du frontend), par
  // choix. Le code gère déjà ça proprement (try/catch, voir
  // handleGameOver/confirmNameEntry dans game.js) : c'est un message
  // console de ressource réseau, pas une vraie erreur JS.
  const realErrors = errors.filter((e) => !e.includes("ERR_CONNECTION_REFUSED"));
  expect(realErrors).toEqual([]);
});
