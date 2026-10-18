// Vérifie le jeu en ligne après un déploiement : ce que les tests locaux ne
// voient pas, parce qu'il dépend du serveur (politique de sécurité CSP,
// fichiers manquants, classement injoignable).
//
// Usage, depuis e2e/ :  npm run smoke            (le site officiel)
//                       npm run smoke -- <url>   (une autre adresse)
import { chromium } from "@playwright/test";

const url = process.argv[2] || "https://arcadepipe.pazpop.net/";
const problems = [];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console : ${message.text().slice(0, 200)}`);
  });
  page.on("pageerror", (error) => problems.push(`erreur JavaScript : ${error}`));
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()} : ${response.url()}`);
  });

  await page.goto(url, { waitUntil: "load" });
  const version = await page.locator("#version-label").textContent();

  // Les drapeaux du bouton de langue sont des images intégrées au CSS : une CSP
  // trop stricte les bloque sans rien casser d'autre.
  await page.click("#mc-toggle");
  const flag = page.locator("#lang-btn .flag").first();
  const flagLoaded = await flag.evaluate((element) => {
    const source = getComputedStyle(element).backgroundImage.slice(5, -2); // url("...")
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = source;
    });
  });
  if (!flagLoaded) problems.push("bouton de langue : drapeaux bloqués");

  // Le classement répond.
  await page.evaluate(async () => {
    window.smokeGame = (await import("./js/main.js")).game;
  });
  const box = await page.locator("#game-canvas").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + (box.height * (151.2 + 22)) / 270); // CLASSEMENT
  await page.waitForFunction(() => window.smokeGame.mode === "leaderboard" && window.smokeGame.scores, null, { timeout: 8000 }).catch(() => {
    problems.push("classement : aucun score reçu en 8 s");
  });

  console.log(`${url} — ${version}`);
} finally {
  await browser.close();
}

for (const problem of problems) console.log(`PROBLÈME — ${problem}`);
console.log(problems.length ? `${problems.length} problème(s)` : "Tout va bien.");
process.exit(problems.length ? 1 : 0);
