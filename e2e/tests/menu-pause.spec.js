// Le jeu est rendu entièrement en canvas (pas de DOM inspectable pour son
// texte) — ces tests valident donc surtout que les séquences d'interactions
// réelles (clic souris, clavier) ne lèvent aucune erreur JS, plutôt que le
// contenu pixel exact. Les captures d'écran restent le moyen de vérifier
// visuellement (voir test-results/ après un run, ou joue au jeu directement).
import { test, expect } from "@playwright/test";
import { canvasHelpers, collectErrors, gameState, skipHints, waitForMode } from "./helpers.js";

test("le menu se charge sans erreur et les contrôles musique sont visibles", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#music-controls")).toBeVisible();
  await expect(page.locator("#autofire-toggle")).toBeVisible();
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

  // "NON, CONTINUER" ramène à la pause.
  await clickLogical(240, 178);
  await waitForMode(page, "paused");
  await canvas.screenshot({ path: "test-results/confirm-quit-cancelled.png" });

  // Reprendre, puis refaire le chemin en confirmant cette fois.
  await page.keyboard.press("Escape");
  await waitForMode(page, "playing");
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

test("Tab puis Entrée au menu lance une partie, sans envoyer de score", async ({ page }) => {
  const posts = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(new URL(r.url()).pathname);
  });
  await page.goto("/");
  await skipHints(page);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement.id)).not.toBe("name-input");
  await page.keyboard.press("Enter");
  await waitForMode(page, "playing");
  expect(posts).toEqual([]);
});

test("en pause, la scène est figée : deux captures identiques", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  const { canvas, startRun } = canvasHelpers(page);
  await startRun();
  await page.waitForTimeout(2500); // le temps que des ennemis soient à l'écran
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
  await page.keyboard.press("Enter");
  await waitForMode(page, "leaderboard");
});

test("un réglage cliqué ne garde pas le focus : Espace ne le rebascule pas", async ({ page }) => {
  await page.goto("/");
  await skipHints(page);
  await page.click("#autofire-toggle"); // décoche (le tir automatique est actif par défaut)
  await page.keyboard.press("Space");
  await expect(page.locator("#autofire-toggle")).not.toBeChecked();

  // Bouton Pause cliqué en partie, reprise au clavier : Espace ne remet pas en pause.
  const { startRun } = canvasHelpers(page);
  await startRun();
  await page.click("#pause-btn");
  await waitForMode(page, "paused");
  await page.keyboard.press("KeyP");
  await waitForMode(page, "playing");
  await page.keyboard.press("Space");
  await page.waitForTimeout(300); // rien ne doit se passer : pas d'état à attendre
  expect((await gameState(page)).mode).toBe("playing");
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
