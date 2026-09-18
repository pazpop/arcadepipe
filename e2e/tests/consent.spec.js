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

test("bouton Plein écran : présent, clic sans erreur", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.locator("#fullscreen-btn")).toBeVisible();
  await page.click("#fullscreen-btn");
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});
