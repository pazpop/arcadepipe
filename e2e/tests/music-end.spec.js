// Fin naturelle d'une piste : une autre piste est tirée et joue réellement.
import { test, expect } from "@playwright/test";
import { skipHints } from "./helpers.js";

test("fin de piste : une autre piste démarre et joue", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto("/");
  await skipHints(page);
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.press("Enter"); // JOUER : la musique démarre avec la partie

  const lecture = () =>
    page.evaluate(async () => {
      const { music } = await import("/js/main.js");
      const a = music.audio;
      return { track: music.trackIndex, pos: a.currentTime, playing: !a.paused };
    });
  await expect.poll(async () => (await lecture()).pos > 0, { timeout: 15000 }).toBe(true);

  const avant = await lecture();
  // Fin de piste simulée : le serveur de test ne gère pas les requêtes Range,
  // donc pas de saut possible dans un MP3 pas encore entièrement chargé.
  await page.evaluate(async () => {
    const { music } = await import("/js/main.js");
    music.audio.dispatchEvent(new Event("ended"));
  });

  // Nouvelle piste (jamais la même d'affilée), réellement en lecture depuis son début.
  await expect.poll(async () => {
    const l = await lecture();
    return l.track !== avant.track && l.playing && l.pos > 0 && l.pos < 5;
  }, { timeout: 15000 }).toBe(true);
  expect(pageErrors).toEqual([]);
});
