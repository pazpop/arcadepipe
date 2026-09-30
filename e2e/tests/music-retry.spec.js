// Un 429 sur les .xm ne doit ni être passé au lecteur comme un fichier audio
// (fetch() ne rejette pas sur un statut HTTP d'erreur), ni déclencher une
// rafale de requêtes : retry différé, délai plafonné (music.js, _loadCurrent).
// Récit : docs/audio-saga.md, round 3.
import { test, expect } from "@playwright/test";
import { skipHints } from "./helpers.js";

test("429 sur les fichiers musique : pas de rafale de requêtes, volume récupéré", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  let requestCount = 0;
  await page.route("**/music/*.xm", (route) => {
    requestCount++;
    route.fulfill({ status: 429, contentType: "text/plain", body: "Too Many Requests" });
  });

  await page.goto("/");
  await skipHints(page);
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.up();

  // Retry différé (2 s, 4 s, 6 s…, délai plafonné à 10 s) : au plus quelques
  // requêtes dans cette fenêtre, jamais une rafale.
  await page.waitForTimeout(9000);
  const countAfterRetries = requestCount;
  await page.waitForTimeout(4000);
  expect(requestCount).toBeLessThanOrEqual(8); // large marge, pas fragile sur le timing exact
  expect(requestCount).toBeLessThanOrEqual(countAfterRetries + 1); // au plus une tentative de plus, jamais une rafale

  const gain = await page.evaluate(async () => {
    const { music } = await import("/js/main.js");
    return { gain: music.player.gain.gain.value, volume: music.volume };
  });
  expect(Math.abs(gain.gain - gain.volume)).toBeLessThan(0.05); // volume récupéré, pas bloqué à 0

  expect(pageErrors).toEqual([]);
});
