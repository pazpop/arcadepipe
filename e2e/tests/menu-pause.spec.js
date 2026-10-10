// Menus, pause, aide, crédits, panneau de réglages. Ces tests suivent l'écran
// courant (mode) et lisent les textes dessinés dans le canvas (screenText) ;
// ils laissent des captures dans test-results/.
import { test, expect, canvasHelpers, collectErrors, gameState, screenText, skipHints, waitForMode } from "./helpers.js";

test("le menu se charge sans erreur et les contrôles musique sont visibles", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#music-controls")).toBeVisible();
  await expect(page.locator("#autofire-toggle")).toBeVisible();
  await expect.poll(() => screenText(page)).toContain("JOUER");
  expect(errors).toEqual([]);
});

test("clic souris dans le menu pause : REPRENDRE reprend la partie", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  const { canvas, startRun, clickLogical } = canvasHelpers(page);
  await startRun();

  await page.keyboard.press("KeyP");
  await waitForMode(page, "paused");
  await clickLogical(240, 132); // REPRENDRE
  await waitForMode(page, "playing");
  await canvas.screenshot({ path: "test-results/pause-resume.png" });

  expect(errors).toEqual([]);
});

test("quitter depuis la pause demande confirmation avant de perdre la partie", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  const { canvas, startRun, clickLogical } = canvasHelpers(page);
  await startRun();

  await page.keyboard.press("KeyP");
  await waitForMode(page, "paused");
  // Pause : REPRENDRE/AIDE/MENU PRINCIPAL (PAUSE_OPTIONS dans hud.js).
  await clickLogical(240, 172); // MENU PRINCIPAL depuis la pause -> doit ouvrir la confirmation
  await canvas.screenshot({ path: "test-results/confirm-quit.png" });

  // "NON, CONTINUER" ramène au menu de pause : son option REPRENDRE répond de
  // nouveau (à cet endroit, l'écran de confirmation n'a aucune option).
  await clickLogical(240, 178);
  await canvas.screenshot({ path: "test-results/confirm-quit-cancelled.png" });
  await clickLogical(240, 132); // REPRENDRE
  await waitForMode(page, "playing");

  // Refaire le chemin en confirmant cette fois.
  await page.keyboard.press("KeyP");
  await waitForMode(page, "paused");
  await clickLogical(240, 172); // MENU PRINCIPAL
  await clickLogical(240, 158); // OUI, QUITTER
  await waitForMode(page, "menu");
  await canvas.screenshot({ path: "test-results/confirm-quit-accepted.png" });

  expect(errors).toEqual([]);
});

test("l'aide de bienvenue s'affiche à la première partie et se ferme au clic", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  // Hints activées (comportement par défaut, pas de skipHints ici) : c'est
  // justement l'aide elle-même qu'on veut voir apparaître.
  const { canvas, startRun, clickLogical } = canvasHelpers(page);
  await startRun("help");
  await canvas.screenshot({ path: "test-results/intro-hint-shown.png" });

  await clickLogical(240, 232); // CONTINUER
  await waitForMode(page, "playing");
  await canvas.screenshot({ path: "test-results/intro-hint-closed.png" });

  const seen = await page.evaluate(() => localStorage.getItem("arcadepipe_seen_intro"));
  expect(seen).toBe("1");
  expect(errors).toEqual([]);
});

test("l'aide est accessible depuis le menu principal et depuis la pause", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  const { canvas, startRun, clickLogical } = canvasHelpers(page);

  // MENU_OPTIONS = ["JOUER", "CLASSEMENT", "AIDE", "CRÉDITS"] — AIDE est le 3e.
  await clickLogical(240, 151.2 + 2 * 22);
  await waitForMode(page, "help");
  await canvas.screenshot({ path: "test-results/help-from-menu.png" });
  await clickLogical(240, 232); // CONTINUER -> retour au menu
  await waitForMode(page, "menu");
  await canvas.screenshot({ path: "test-results/help-closed-to-menu.png" });

  await startRun();
  await page.keyboard.press("KeyP");
  await waitForMode(page, "paused");
  await clickLogical(240, 152); // AIDE (2e option de la pause)
  await waitForMode(page, "help");
  await canvas.screenshot({ path: "test-results/help-from-pause.png" });
  await clickLogical(240, 232); // CONTINUER -> retour à la pause (pas reprise directe)
  await waitForMode(page, "paused");
  await canvas.screenshot({ path: "test-results/help-closed-to-pause.png" });

  expect(errors).toEqual([]);
});

test("toutes les pages de l'aide et les crédits s'affichent", async ({ page }) => {
  await page.goto("/");
  const { canvas, clickLogical } = canvasHelpers(page);

  await clickLogical(240, 151.2 + 2 * 22); // AIDE
  await waitForMode(page, "help");
  // Un titre propre à chaque page, dans l'ordre.
  const pages = ["DÉPLACEMENT", "COLLISION", "RACCOURCIS CLAVIER", "AIDE — BONUS", "AIDE — ENNEMIS"];
  for (const [index, heading] of pages.entries()) {
    if (index > 0) await clickLogical(326, 210); // SUIV.
    await expect.poll(() => screenText(page)).toContain(heading);
    expect(await screenText(page)).toContain(`${index + 1}/${pages.length}`);
    await canvas.screenshot({ path: `test-results/help-page-${index + 1}.png` });
  }
  await clickLogical(326, 210); // SUIV. sur la dernière page : on y reste
  await page.waitForTimeout(300); // rien ne doit se passer : pas d'état à attendre
  expect((await gameState(page)).helpPage).toBe(pages.length - 1);
  await clickLogical(240, 232); // CONTINUER
  await waitForMode(page, "menu");

  await clickLogical(240, 151.2 + 3 * 22); // CRÉDITS
  await waitForMode(page, "credits");
  await canvas.screenshot({ path: "test-results/credits.png" });
  await page.keyboard.press("Escape");
  await waitForMode(page, "menu");
});

test("le bouton Aide du panneau (bas gauche) ouvre l'aide directement, au menu et en jeu", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  const { canvas, startRun, clickLogical } = canvasHelpers(page);

  await page.locator("#help-btn").click();
  await waitForMode(page, "help");
  await canvas.screenshot({ path: "test-results/help-btn-from-menu.png" });
  await page.keyboard.press("Escape"); // ferme l'aide -> retour au menu
  await waitForMode(page, "menu");

  await startRun();
  await page.locator("#help-btn").click();
  await waitForMode(page, "help");
  await canvas.screenshot({ path: "test-results/help-btn-from-playing.png" });
  await clickLogical(240, 232); // CONTINUER -> retour direct en jeu (pas à la pause)
  await waitForMode(page, "playing");
  await canvas.screenshot({ path: "test-results/help-btn-closed-to-playing.png" });

  expect(errors).toEqual([]);
});

test("Tab n'atteint jamais le champ du pseudo ; Entrée sur un réglage n'agit pas dans le jeu", async ({ page }) => {
  const posts = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(new URL(r.url()).pathname);
  });
  await page.goto("/");
  await skipHints(page);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement.id)).not.toBe("name-input");

  // Entrée sur le bouton Vitesse change la vitesse, et rien d'autre : pas de partie lancée.
  await page.locator("#speed-btn").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#speed-btn")).toHaveText("x1.5");
  await page.waitForTimeout(300); // rien ne doit se passer : pas d'état à attendre
  expect((await gameState(page)).mode).toBe("menu");
  expect(posts).toEqual([]);
});

test("Entrée du pavé numérique : comme Entrée", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  await page.keyboard.press("NumpadEnter"); // JOUER est sélectionné
  await waitForMode(page, "playing");
});

test("aide ouverte au clavier depuis le panneau : Entrée la referme", async ({ page }) => {
  await page.goto("/");
  await page.locator("#help-btn").focus();
  await page.keyboard.press("Enter");
  await waitForMode(page, "help");
  await page.keyboard.press("Enter"); // CONTINUER
  await waitForMode(page, "menu");
});

test("flèches sur un curseur de volume : elles règlent le volume, pas le menu", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  const volume = page.locator("#music-volume");
  await volume.focus();
  const before = Number(await volume.inputValue());
  await page.keyboard.press("ArrowDown");
  expect(Number(await volume.inputValue())).toBeLessThan(before);
  // La sélection du menu n'a pas bougé : hors du curseur, Entrée lance JOUER.
  await volume.blur();
  await page.keyboard.press("Enter");
  await waitForMode(page, "playing");
});

test("clic droit sur une option du menu : sans effet", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  const { toPage } = canvasHelpers(page);
  const play = await toPage(240, 150);
  await page.mouse.click(play.x, play.y, { button: "right" });
  await page.waitForTimeout(300); // rien ne doit se passer : pas d'état à attendre
  expect((await gameState(page)).mode).toBe("menu");
});

test("le panneau de réglages est replié dès le HTML : il ne s'affiche pas un instant au chargement", async ({ request }) => {
  expect(await (await request.get("/")).text()).toContain('<div id="mc-wrap" class="collapsed">');
});

test("en pause, la scène est figée : deux captures identiques", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  const { canvas, startRun } = canvasHelpers(page);
  await startRun();
  // Des tirs à l'écran : s'ils avançaient encore en pause, les captures différeraient.
  await expect.poll(async () => (await gameState(page)).playerBullets).toBeGreaterThan(0);
  await page.keyboard.press("KeyP");
  await waitForMode(page, "paused");
  const first = await canvas.screenshot();
  await page.waitForTimeout(300);
  expect((await canvas.screenshot()).equals(first)).toBe(true);
});

test("la souris immobile sur une option n'empêche pas de choisir au clavier", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  const { moveLogical } = canvasHelpers(page);
  await moveLogical(240, 151.2); // sur JOUER
  await page.keyboard.press("ArrowDown"); // CLASSEMENT
  await page.waitForTimeout(200); // plusieurs images : le survol ne doit pas ramener la sélection sur JOUER
  await page.keyboard.press("Enter");
  await waitForMode(page, "leaderboard");
});

test("panneau replié : ses réglages ne se parcourent plus au clavier", async ({ page }) => {
  await page.goto("/");
  await page.click("#mc-toggle"); // replie le panneau (ouvert par la configuration des tests)
  await expect(page.locator("#music-volume")).toBeHidden();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement.closest("#music-controls") === null)).toBe(true);
  }
});

test("bouton Plein écran : le jeu passe en plein écran", async ({ page }) => {
  await page.goto("/");
  await page.click("#fullscreen-btn");
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe("game-container");
});

test("un réglage cliqué ne garde pas le focus : Espace ne le rebascule pas", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  await page.click("#autofire-toggle"); // décoche (le tir automatique est actif par défaut)
  await page.keyboard.press("Space");
  await expect(page.locator("#autofire-toggle")).not.toBeChecked();

  // Même chose pour un bouton : la vitesse passe à x1.5 au clic, et Espace ne la change plus.
  await page.click("#speed-btn");
  await expect(page.locator("#speed-btn")).toHaveText("x1.5");
  await page.keyboard.press("Space");
  await expect(page.locator("#speed-btn")).toHaveText("x1.5");
});

test("bouton Pause au clavier : Entrée met en pause, puis une seconde Entrée choisit REPRENDRE", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  const { startRun, moveLogical } = canvasHelpers(page);
  await startRun();
  await moveLogical(240, 132); // là où sera REPRENDRE, pour que la souris ne survole pas une autre option
  await page.locator("#pause-btn").focus();
  await page.keyboard.press("Enter");
  await waitForMode(page, "paused");
  await page.waitForTimeout(300); // l'Entrée ne doit pas choisir REPRENDRE à l'image suivante
  expect((await gameState(page)).mode).toBe("paused");
  await page.keyboard.press("Enter"); // le bouton n'a pas gardé le focus : c'est le menu de pause qui la reçoit
  await waitForMode(page, "playing");
});

test("case Filtre rétro : coupe le filtre, et le choix tient au rechargement", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#crt-toggle")).toBeChecked();
  await expect(page.locator("#crt-overlay")).toBeVisible();
  await page.locator("#crt-toggle").uncheck();
  await expect(page.locator("#crt-overlay")).toBeHidden();
  await page.reload();
  await expect(page.locator("#crt-toggle")).not.toBeChecked();
  await expect(page.locator("#crt-overlay")).toBeHidden();
});
