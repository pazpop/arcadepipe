// Régression : fin naturelle d'une piste -> UNE seule requête pour la suivante,
// et la musique repart. Avant correctif, le worklet reposait 'end' à chaque
// quantum audio (des centaines/s) tant qu'aucune nouvelle piste n'était
// chargée ; chaque 'end' relançait un fetch avec un nouveau jeton -> les
// réponses arrivaient toujours périmées -> boucle de GET sans fin, jamais de
// musique, RAM qui grimpe.
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

  // Piste en cours de lecture (métadonnées reçues du worklet). Boucle dans la
  // page : waitForFunction avec une fonction async retournerait une promesse
  // (toujours truthy) et n'attendrait rien.
  await page.evaluate(async () => {
    const { music } = await import("/js/main.js");
    const t0 = Date.now();
    while (!(music.player.duration > 1 && music.player.currentTime > 0)) {
      if (Date.now() - t0 > 15000) throw new Error("piste jamais démarrée " + JSON.stringify({ s: music.started, d: music.player.duration, t: music.player.currentTime, n: !!music.player.processNode, tok: music._loadToken, ctx: music.player.context.state }));
      await new Promise((r) => setTimeout(r, 100));
    }
  });

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

  await page.waitForTimeout(6000);
  const stats = await page.evaluate(async () => {
    const { music } = await import("/js/main.js");
    return { ends: window.__ends, pos: music.player.currentTime, dur: music.player.duration };
  });
  console.log(`[repro] 'end' reçus: ${stats.ends}, requêtes .xm depuis la fin: ${requests - before}, pos=${stats.pos}, dur=${stats.dur}`);

  expect(stats.ends).toBeLessThanOrEqual(2);
  expect(requests - before).toBeLessThanOrEqual(2);
  // La musique a réellement redémarré (nouvelle piste en cours), pas restée figée à la fin de l'ancienne.
  expect(stats.pos).toBeGreaterThan(0);
  expect(stats.dur - stats.pos).toBeGreaterThan(0.5);
  expect(pageErrors).toEqual([]);
});
