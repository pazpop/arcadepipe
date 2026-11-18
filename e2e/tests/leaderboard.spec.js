// Classement local : les scores de ce navigateur (scores.js, localStorage).
import { test, expect, canvasHelpers, dieOnBossHull, gameState, screenText, skipHints, waitForMode } from "./helpers.js";

const names = async (page) => (await gameState(page)).scores.map((s) => s.player_name);
const savedNames = async (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("arcadepipe_scores") || "[]").map((s) => s.player_name));

test("le classement affiche les scores du navigateur, du meilleur au moins bon, et les parties jouées", async ({ page }) => {
  await page.addInitScript(() => {
    const scores = [
      { player_name: "BETA", score: 900, wave: 3, kills: 30 },
      { player_name: "ALPHA", score: 500, wave: 2, kills: 12 },
    ];
    localStorage.setItem("arcadepipe_scores", JSON.stringify(scores));
    localStorage.setItem("arcadepipe_games_played", "7");
  });
  await page.goto("/");
  const { clickLogical } = canvasHelpers(page);
  await clickLogical(240, 151.2 + 22); // CLASSEMENT
  await waitForMode(page, "leaderboard");
  expect(await names(page)).toEqual(["BETA", "ALPHA"]);
  await expect.poll(() => screenText(page)).toContain("PARTIES JOUÉES : 7");
});

test("fin de partie : top annoncé ; score inscrit en rejouant, au tap sur VALIDER, puis au clavier", async ({ page }) => {
  test.setTimeout(120000); // trois parties jusqu'au premier boss
  await page.goto("/");
  await skipHints(page);
  await page.evaluate(async () => {
    const { PLAYER, BOSS } = await import("/js/config.js");
    PLAYER.startingLives = 1;
    BOSS.bulletSpeed = 0; // seule la coque du boss peut toucher
  });
  const { clickLogical } = canvasHelpers(page);

  // Joue jusqu'au boss, fonce dans sa coque, et attend l'annonce du top (moins de dix scores gardés).
  async function dieAndQualify() {
    await dieOnBossHull(page); // score non nul : un score nul n'entre pas au classement
    await expect.poll(() => screenText(page)).toContain("TU ENTRES DANS LE TOP 10 !");
    expect(await screenText(page)).toContain("ENTRER MON PSEUDO");
  }

  // 1. REJOUER : nouvelle partie aussitôt, score inscrit sous le pseudo par défaut.
  await dieAndQualify();
  await clickLogical(240, 167.4);
  await waitForMode(page, "playing");
  expect(await savedNames(page)).toEqual(["AAA"]);

  // 2. ENTRER MON PSEUDO, validé au tap sur VALIDER sans rien taper (téléphone sans clavier).
  await dieAndQualify();
  await clickLogical(240, 187.4);
  await waitForMode(page, "name_entry");
  await clickLogical(240, 118); // VALIDER
  await waitForMode(page, "leaderboard");
  expect(await savedNames(page)).toEqual(["AAA", "AAA"]);
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
  expect(await names(page)).toContain("ZO M7");
  expect((await gameState(page)).mode).toBe("leaderboard"); // l'Entrée de validation ne l'a pas refermé
});
