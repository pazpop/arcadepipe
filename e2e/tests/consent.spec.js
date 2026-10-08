// Bandeau de consentement (frontend/js/consent.js) : Google Analytics ne doit
// JAMAIS être chargé avant "Accepter". Le réseau est intercepté (pas de vraie
// requête vers googletagmanager.com pendant les tests).
import { test, expect } from "@playwright/test";
import { collectErrors } from "./helpers.js";

const GTM = /googletagmanager\.com/;

async function trackGtm(page) {
  const requests = [];
  await page.route(GTM, (route) => {
    requests.push(route.request().url());
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });
  return requests;
}

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
  await expect(page.locator("#cookie-banner")).toBeHidden();
  await page.waitForTimeout(300);
  expect(gtm.length).toBe(1); // rien de plus après le rechargement
});

test("bouton Plein écran : présent, clic sans erreur", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.locator("#fullscreen-btn")).toBeVisible();
  await page.click("#fullscreen-btn");
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});
