// Le jeu est rendu entièrement en canvas (pas de DOM inspectable pour son
// texte) — ces tests valident donc surtout que les séquences d'interactions
// réelles (clic souris, clavier) ne lèvent aucune erreur JS, plutôt que le
// contenu pixel exact. Les captures d'écran restent le moyen de vérifier
// visuellement (voir test-results/ après un run, ou joue au jeu directement).
import { test, expect } from "@playwright/test";
import { canvasHelpers, collectErrors, skipHints } from "./helpers.js";

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
  await page.waitForTimeout(200);

  await page.keyboard.press("KeyP");
  await page.waitForTimeout(150);
  await clickLogical(240, 132); // REPRENDRE
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: "test-results/pause-resume.png" });

  expect(errors).toEqual([]);
});

test("quitter depuis la pause demande confirmation avant de perdre la partie", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  const { canvas, startRun, clickLogical } = canvasHelpers(page);
  await startRun();
  await page.waitForTimeout(200);

  await page.keyboard.press("KeyP");
  await page.waitForTimeout(150);
  // Pause a 3 options désormais (REPRENDRE/AIDE/MENU PRINCIPAL, voir
  // PAUSE_OPTIONS dans hud.js) — MENU PRINCIPAL est le 3e, pas le 2e.
  await clickLogical(240, 172); // MENU PRINCIPAL depuis la pause -> doit ouvrir la confirmation
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: "test-results/confirm-quit.png" });

  // "NON, CONTINUER" doit être la sélection par défaut (sécurité contre une
  // sortie accidentelle) — on l'active et on doit retrouver la pause normale.
  await clickLogical(240, 178);
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: "test-results/confirm-quit-cancelled.png" });

  // Reprendre, puis refaire le chemin en confirmant cette fois.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await page.keyboard.press("KeyP");
  await page.waitForTimeout(100);
  await clickLogical(240, 172); // MENU PRINCIPAL (voir commentaire plus haut)
  await page.waitForTimeout(100);
  await clickLogical(240, 158); // OUI, QUITTER
  await page.waitForTimeout(200);
  await canvas.screenshot({ path: "test-results/confirm-quit-accepted.png" });

  expect(errors).toEqual([]);
});

test("l'aide de bienvenue s'affiche à la première partie et se ferme au clic", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  // Hints activées (comportement par défaut, pas de skipHints ici) : c'est
  // justement l'aide elle-même qu'on veut voir apparaître.
  const { canvas, startRun, clickLogical } = canvasHelpers(page);
  await startRun();
  await page.waitForTimeout(200);
  await canvas.screenshot({ path: "test-results/intro-hint-shown.png" });

  await clickLogical(240, 232); // CONTINUER
  await page.waitForTimeout(150);
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
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: "test-results/help-from-menu.png" });
  await clickLogical(240, 232); // CONTINUER -> retour au menu
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: "test-results/help-closed-to-menu.png" });

  await startRun();
  await page.waitForTimeout(200);
  await page.keyboard.press("KeyP");
  await page.waitForTimeout(150);
  await clickLogical(240, 152); // AIDE (2e option de la pause)
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: "test-results/help-from-pause.png" });
  await clickLogical(240, 232); // CONTINUER -> retour à la pause (pas reprise directe)
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: "test-results/help-closed-to-pause.png" });

  expect(errors).toEqual([]);
});

test("le bouton Aide du panneau (bas gauche) ouvre l'aide directement, au menu et en jeu", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await skipHints(page);
  const { canvas, startRun, clickLogical } = canvasHelpers(page);

  await page.locator("#help-btn").click();
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: "test-results/help-btn-from-menu.png" });
  await page.keyboard.press("Escape"); // ferme l'aide -> retour au menu
  await page.waitForTimeout(150);

  await startRun();
  await page.waitForTimeout(200);
  await page.locator("#help-btn").click();
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: "test-results/help-btn-from-playing.png" });
  await clickLogical(240, 232); // CONTINUER -> retour direct en jeu (pas à la pause)
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: "test-results/help-btn-closed-to-playing.png" });

  expect(errors).toEqual([]);
});
