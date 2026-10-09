// Un 429 sur les pistes ne doit pas déclencher de rafale de requêtes : retry
// différé, délai plafonné (audio/music.js, _retryLater).
import { test, expect, skipHints } from "./helpers.js";

test("429 sur les fichiers musique : pas de rafale de requêtes", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  let requestCount = 0;
  await page.route("**/music/*.mp3", (route) => {
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
  expect(requestCount).toBeGreaterThan(0);
  expect(requestCount).toBeLessThanOrEqual(8); // large marge, pas fragile sur le timing exact
  expect(requestCount).toBeLessThanOrEqual(countAfterRetries + 1); // au plus une tentative de plus, jamais une rafale

  expect(pageErrors).toEqual([]);
});
