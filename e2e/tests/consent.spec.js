// Mesure d'audience (frontend/js/consent.js) : désactivée sans identifiant, et
// avec un identifiant, jamais chargée avant "Accepter". Le réseau est
// intercepté (aucune vraie requête vers googletagmanager.com).
import { test, expect, collectErrors, enableAnalytics } from "./helpers.js";

const GTM = /googletagmanager\.com/;

// Active la mesure d'audience et note les chargements du script de Google.
async function trackGtm(page) {
  await enableAnalytics(page);
  const requests = [];
  await page.route(GTM, (route) => {
    requests.push(route.request().url());
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });
  return requests;
}

test("sans identifiant (par défaut) : ni bandeau, ni bouton Cookies, ni chargement", async ({ page }) => {
  const requests = [];
  await page.route(GTM, (route) => {
    requests.push(route.request().url());
    route.abort();
  });
  const config = page.waitForResponse(/site-config\.json/);
  await page.goto("/");
  await config; // c'est après ce fichier que le jeu décide de charger ou non la mesure
  await page.waitForTimeout(300); // rien ne doit se passer : pas d'état à attendre
  await expect(page.locator("#cookie-banner")).toBeHidden();
  await expect(page.locator("#cookie-btn")).toBeHidden();
  expect(requests).toEqual([]);
});

test("sans choix : bandeau affiché, aucun chargement de Google Analytics", async ({ page }) => {
  const errors = collectErrors(page);
  const gtm = await trackGtm(page);
  await page.goto("/");
  await expect(page.locator("#cookie-banner")).toBeVisible();
  await page.waitForTimeout(300);
  expect(gtm).toEqual([]);
  expect(errors).toEqual([]);
});

test("Refuser : bandeau masqué, rien chargé, choix mémorisé au rechargement", async ({ page }) => {
  const gtm = await trackGtm(page);
  await page.goto("/");
  await page.click("#cookie-decline");
  await expect(page.locator("#cookie-banner")).toBeHidden();
  await page.reload();
  await expect(page.locator("#cookie-btn")).toBeVisible(); // le choix mémorisé a été relu
  await expect(page.locator("#cookie-banner")).toBeHidden();
  await page.waitForTimeout(300);
  expect(gtm).toEqual([]);
});

test("Accepter : Google Analytics chargé une seule fois, choix mémorisé", async ({ page }) => {
  const errors = collectErrors(page);
  const gtm = await trackGtm(page);
  await page.goto("/");
  await page.click("#cookie-accept");
  await expect(page.locator("#cookie-banner")).toBeHidden();
  await expect.poll(() => gtm.length).toBe(1);

  await page.reload();
  await expect(page.locator("#cookie-banner")).toBeHidden();
  await expect.poll(() => gtm.length).toBe(2); // 1 par chargement de page, jamais 2 dans la même page
  expect(errors).toEqual([]);
});

test("bouton Cookies : rouvre le bandeau ; accepter après un refus charge Analytics", async ({ page }) => {
  const gtm = await trackGtm(page);
  await page.goto("/");
  await page.click("#cookie-decline");
  await page.click("#cookie-btn");
  await expect(page.locator("#cookie-banner")).toBeVisible();
  await page.click("#cookie-accept");
  await expect(page.locator("#cookie-banner")).toBeHidden();
  await expect.poll(() => gtm.length).toBe(1);
});

test("bouton Cookies : retirer son accord coupe Analytics, efface ses cookies, et tient au rechargement", async ({ page }) => {
  const gtm = await trackGtm(page);
  await page.goto("/");
  await page.click("#cookie-accept");
  await expect.poll(() => gtm.length).toBe(1);
  await page.evaluate(() => (document.cookie = "_ga=GA1.1.123; path=/"));

  await page.click("#cookie-btn");
  await page.click("#cookie-decline");
  const state = await page.evaluate(() => ({
    disabled: Object.entries(window).some(([k, v]) => k.startsWith("ga-disable-") && v === true),
    cookies: document.cookie,
  }));
  expect(state.disabled).toBe(true);
  expect(state.cookies).not.toContain("_ga");

  await page.reload();
  await expect(page.locator("#cookie-btn")).toBeVisible(); // le choix mémorisé a été relu
  await expect(page.locator("#cookie-banner")).toBeHidden();
  await page.waitForTimeout(300);
  expect(gtm.length).toBe(1); // rien de plus après le rechargement
});

