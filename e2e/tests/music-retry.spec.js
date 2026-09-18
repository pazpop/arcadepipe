// Régression pour le vrai bug de "musique silencieuse au bout d'un moment"
// (v2.50, confirmé en prod via l'onglet Réseau : des 429 sur /music/*.xm).
// fetch() ne rejette jamais sur un statut d'erreur HTTP — un 429 traité
// comme un fichier audio valide plantait le lecteur, déclenchait un retry
// immédiat qui se reprenait aussitôt un 429, etc. : une rafale de requêtes
// qui ne s'arrêtait jamais. Voir music.js (_loadCurrent) pour le correctif
// (vérification r.ok + retry différé et plafonné).
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

  // Retry différé (2s/4s/6s, puis plafonné à 10s, jamais de plafond sur le
  // NOMBRE de tentatives) — avec l'ancien code (retry immédiat), cette
  // fenêtre suffisait à générer des dizaines de requêtes en rafale.
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
