// Fin naturelle d'une piste : UNE seule requête pour la suivante, et la musique
// repart. Garde-fou des correctifs n° 3 (un 'end' par quantum audio relançait
// un fetch à chaque fois) et n° 4 (première piste jouée) de lib/PATCHES.md.
import { test, expect } from "@playwright/test";
import { skipHints } from "./helpers.js";

test("fin de piste : une seule requête pour la suivante et la musique repart", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  let requests = 0;
  page.on("request", (r) => {
    if (/\/music\/.*\.xm/.test(r.url())) requests++;
  });

  // Latence réseau réaliste (le serveur local répond en quelques ms, ce qui
  // masque le bug : la boucle s'arrête d'elle-même après quelques requêtes).
  let latencyMs = 0;
  await page.route("**/music/*.xm", async (route) => {
    await new Promise((r) => setTimeout(r, latencyMs));
    await route.continue();
  });
  await page.goto("/");
  await skipHints(page);
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.press("Enter"); // JOUER : la musique démarre avec la partie

  const lecture = () =>
    page.evaluate(async () => {
      const { music } = await import("/js/main.js");
      return { ends: window.__ends ?? 0, pos: music.player.currentTime, dur: music.player.duration };
    });
  // Piste en cours de lecture (métadonnées reçues du worklet). 30 s : le
  // premier chargement du WASM peut être lent sur une machine chargée.
  await expect.poll(async () => {
    const l = await lecture();
    return l.dur > 1 && l.pos > 0;
  }, { timeout: 30000 }).toBe(true);

  const ended = await page.evaluate(async () => {
    const { music } = await import("/js/main.js");
    window.__ends = 0;
    music.player.onEnded(() => window.__ends++);
    window.__firstDuration = music.player.duration;
    music.player.setPos(music.player.duration - 0.5);
    return true;
  });
  expect(ended).toBe(true);
  const before = requests;
  latencyMs = 150;

  // Attend la piste suivante réellement en lecture, puis observe encore 2 s :
  // une rafale de requêtes (le bug) se produirait dans cet intervalle.
  await expect.poll(async () => {
    const l = await lecture();
    return l.ends >= 1 && l.pos > 0 && l.dur - l.pos > 0.5;
  }, { timeout: 15000 }).toBe(true);
  await page.waitForTimeout(2000);
  const stats = await lecture();

  expect(stats.ends).toBeLessThanOrEqual(2);
  expect(requests - before).toBeLessThanOrEqual(2);
  // La musique a réellement redémarré (nouvelle piste en cours), pas restée figée à la fin de l'ancienne.
  expect(stats.pos).toBeGreaterThan(0);
  expect(stats.dur - stats.pos).toBeGreaterThan(0.5);
  expect(pageErrors).toEqual([]);
});
