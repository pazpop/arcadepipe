// Pages annexes : confidentialité et kit presse.
import { test, expect } from "./helpers.js";

test("page de confidentialité : le lien du panneau mène à la section de la langue du jeu", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#music-controls .privacy-link")).toHaveAttribute("href", "privacy.html#fr");
  await page.goto("/privacy.html#fr");
  await expect(page.locator("#fr h1")).toHaveText("Confidentialité");
  await expect(page.locator("#en h1")).toHaveText("Privacy");
});

test("kit presse : la page s'affiche, images et vidéo chargées", async ({ page }) => {
  await page.goto("/press/");
  await expect(page.locator("#en h1")).toContainText("Press kit");
  const broken = await page.evaluate(async () => {
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    return [...document.images].filter((img) => img.naturalWidth === 0).map((img) => img.src);
  });
  expect(broken).toEqual([]);
  await expect.poll(() => page.evaluate(() => document.querySelector("video").readyState)).toBeGreaterThan(0);
});
