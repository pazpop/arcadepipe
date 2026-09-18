// Carte de partage : le QR code doit rester lisible (contraste préservé) même
// après le redimensionnement + la recompression JPEG qu'un réseau social
// fait subir à l'image. Décodé avec jsQR dans la page (pas de vrai téléphone).
// Régression : un shadowBlur laissé actif par le texte précédent teintait
// le QR (crème/olive) sans que jsQR, tolérant, ne le signale — d'où aussi la
// vérification directe des pixels noir/blanc au centre d'un module.
import { test, expect } from "@playwright/test";
import fs from "fs";
import { createRequire } from "module";
import { collectErrors } from "./helpers.js";

const require = createRequire(import.meta.url);
const JSQR_SRC = fs.readFileSync(require.resolve("jsqr/dist/jsQR.js"), "utf8");
const GAME_URL = "https://arcadepipe.pazpop.net";

test("le QR de la carte de partage se décode, y compris après recompression JPEG", async ({ page }) => {
  const errors = collectErrors(page);
  await page.route(/googletagmanager\.com/, (r) => r.fulfill({ status: 200, body: "" }));
  await page.goto("/");
  await page.addScriptTag({ content: JSQR_SRC });

  const decoded = await page.evaluate(async () => {
    const { createShareCardCanvas } = await import("/js/shareCard.js");
    const card = createShareCardCanvas({ score: 12345, wave: 7, kills: 88, maxGrazeChain: 14, distanceTraveled: 312 });
    const out = {};
    for (const [size, quality] of [[1080, 1], [600, 0.6], [400, 0.5]]) {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const cx = c.getContext("2d");
      cx.imageSmoothingQuality = "high";
      cx.drawImage(card, 0, 0, size, size);
      const img = new Image();
      img.src = c.toDataURL("image/jpeg", quality);
      await img.decode();
      const c2 = document.createElement("canvas");
      c2.width = c2.height = size;
      const cx2 = c2.getContext("2d");
      cx2.drawImage(img, 0, 0);
      const { data } = cx2.getImageData(0, 0, size, size);
      const r = jsQR(data, size, size);
      out[`${size}px`] = r ? r.data : null;
    }
    // Contraste réel sur la carte d'origine : le coin haut-gauche du QR (marqueur
    // de position, toujours noir) et sa marge (toujours blanche).
    const px = card.getContext("2d").getImageData(0, 0, 1080, 1080);
    const at = (x, y) => Array.from(px.data.slice((y * 1080 + x) * 4, (y * 1080 + x) * 4 + 3));
    out.margin = at(446, 846); // quiet zone : blanc pur attendu
    out.finder = at(459, 859); // centre du module (0,0), coin du marqueur de position : noir pur attendu
    return out;
  });

  expect(decoded["1080px"]).toBe(GAME_URL);
  expect(decoded["600px"]).toBe(GAME_URL);
  expect(decoded["400px"]).toBe(GAME_URL);
  expect(decoded.margin).toEqual([255, 255, 255]);
  expect(decoded.finder).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});
