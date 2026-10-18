// Fin naturelle d'une piste : une autre piste est tirée et joue réellement.
import { test, expect } from "./helpers.js";

test("fin de piste : une autre piste démarre et joue", async ({ page }) => {
  await page.goto("/");
  await page.mouse.click(100, 100); // premier geste : la musique démarre

  const lecture = () =>
    page.evaluate(async () => {
      const { music } = await import("/js/main.js");
      const a = music.audio;
      const { AUDIO } = await import("/js/config.js");
      const loaded = a.currentSrc.endsWith(AUDIO.tracks[music.trackIndex]); // le fichier de la piste choisie
      return { track: music.trackIndex, pos: a.currentTime, playing: !a.paused, loaded };
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
    return l.track !== avant.track && l.loaded && l.playing && l.pos > 0 && l.pos < 5;
  }, { timeout: 15000 }).toBe(true);
});
