// Langue du jeu (frontend/js/i18n.js) : suit le navigateur au premier
// lancement, puis le choix fait avec le bouton du panneau est mémorisé.
import { test, expect, collectErrors, enableAnalytics } from "./helpers.js";

test.describe("navigateur en anglais", () => {
  test.use({ locale: "en-US" });

  test("jeu en anglais ; le bouton passe au français, mémorisé au rechargement", async ({ page }) => {
    const errors = collectErrors(page);
    await enableAnalytics(page); // pour le texte du bandeau
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#lang-btn .flag-fr, #lang-btn .flag-qc")).toHaveCount(2); // propose le français
    await expect(page.locator("#help-btn")).toHaveText("Help");
    await expect(page.locator("#cookie-accept")).toHaveText("Accept");
    await page.locator("#game-canvas").screenshot({ path: "test-results/i18n-menu-en.png" });

    await page.click("#cookie-decline");
    await page.click("#lang-btn"); // recharge la page
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await page.reload();
    await expect(page.locator("#help-btn")).toHaveText("Aide");
    expect(errors).toEqual([]);
  });
});

test("navigateur en français : jeu en français", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("#lang-btn .flag-us, #lang-btn .flag-gb")).toHaveCount(2); // propose l'anglais
});

test.describe("navigateur dans une langue non traduite", () => {
  test.use({ locale: "de-DE" });

  test("jeu en anglais par défaut", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test("stockage bloqué (page embarquée, navigation privée) : le bouton de langue change quand même la langue", async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException("stockage bloqué", "SecurityError");
    };
    Object.defineProperty(window, "localStorage", { get: blocked });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.click("#mc-toggle"); // le panneau est replié : son ouverture non plus n'a pas pu être mémorisée
  await page.click("#lang-btn"); // recharge la page
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#help-btn")).toHaveText("Help");
});
