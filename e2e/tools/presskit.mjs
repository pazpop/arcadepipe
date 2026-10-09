// Régénère les captures d'écran et la vidéo du kit presse (frontend/press/).
// Le jeu est joué pour de vrai dans un navigateur ; seuls quelques réglages sont
// forcés pour atteindre vite chaque situation (vagues courtes, bonus garanti).
//
// Usage, depuis e2e/ :  npm run presskit
import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const FRONTEND = path.resolve(import.meta.dirname, "../../frontend");
const OUT = path.join(FRONTEND, "press");
const PORT = 5510;
const SIZE = { width: 1280, height: 720 };

const server = spawn("python", ["-m", "http.server", String(PORT), "--directory", FRONTEND], { stdio: "ignore" });
await new Promise((resolve) => setTimeout(resolve, 1500));
const browser = await chromium.launch();

// Ouvre le jeu en anglais, sans l'aide de bienvenue ni le panneau de réglages.
async function openGame(contextOptions = {}) {
  const context = await browser.newContext({ viewport: SIZE, locale: "en-US", ...contextOptions });
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.evaluate(() => localStorage.setItem("arcadepipe_seen_intro", "1"));
  await page.reload();
  await page.addStyleTag({ content: "#mc-wrap { display: none; }" });
  await page.waitForTimeout(500);
  return { context, page };
}

// Coordonnées logiques du jeu (480x270) vers l'écran.
const at = (x, y) => [(x / 480) * SIZE.width, (y / 270) * SIZE.height];

async function setConfig(page, changes) {
  await page.evaluate(async (c) => {
    const config = await import("/js/config.js");
    for (const [group, values] of Object.entries(c)) Object.assign(config[group], values);
  }, changes);
}

// Lance une partie et joue `seconds` secondes : tir maintenu, vaisseau qui balaie la hauteur.
async function play(page, seconds) {
  await page.mouse.click(...at(240, 150)); // PLAY
  await page.mouse.move(...at(110, 135));
  await page.mouse.down();
  for (let i = 0; i < seconds * 4; i++) {
    await page.mouse.move(...at(110 + 30 * Math.sin(i / 5), 135 + 85 * Math.sin(i / 3)), { steps: 5 });
    await page.waitForTimeout(250);
  }
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

// 1. Écran titre
{
  const { context, page } = await openGame();
  await shot(page, "screenshot-title");
  await context.close();
}

// 2. En partie, vers la vague 4 (vagues raccourcies pour y arriver vite)
{
  const { context, page } = await openGame();
  await setConfig(page, { DIFFICULTY: { baseWaveKills: 3, waveKillsStep: 1 }, PLAYER: { startingLives: 5 } });
  await play(page, 24);
  await shot(page, "screenshot-gameplay");
  await context.close();
}

// 3. Le bonus Chevrotine (drop garanti)
{
  const { context, page } = await openGame();
  await setConfig(page, {
    POWERUP: { dropChanceNormal: 1, fallSpeed: 60, typeWeights: { power: 0, rapid: 0, shotgun: 1, shield: 0 } },
    PLAYER: { startingLives: 5 },
  });
  await page.mouse.click(...at(240, 150));
  await page.mouse.down();
  for (let i = 0; i < 80; i++) {
    const state = await page.evaluate(async () => {
      const { game } = await import("/js/main.js");
      return { buff: game.buffType, powerups: game.powerupsOnScreen };
    });
    if (state.buff) break;
    const target = state.powerups[0] ?? { x: 110, y: 135 + 85 * Math.sin(i / 3) };
    await page.mouse.move(...at(target.x, target.y), { steps: 5 });
    await page.waitForTimeout(250);
  }
  await page.mouse.move(...at(110, 135), { steps: 10 });
  await page.waitForTimeout(1500);
  await shot(page, "screenshot-shotgun");
  await context.close();
}

// 4. Le niveau bonus (vagues vides jusqu'à la 10e)
{
  const { context, page } = await openGame();
  await setConfig(page, {
    DIFFICULTY: { baseWaveKills: 0, waveKillsStep: 0, waveBreakDuration: 0.3, bossWaveEvery: 999 },
    BONUS_LEVEL: { firstScoreThreshold: 0 },
  });
  await page.mouse.click(...at(240, 150));
  await page.mouse.move(...at(110, 135));
  await page.waitForFunction(async () => (await import("/js/main.js")).game.inBonusLevel, null, { timeout: 30000 });
  await page.waitForTimeout(7500); // intro passée, plusieurs anneaux à l'écran
  await shot(page, "screenshot-bonus-level");
  await context.close();
}

// 5. Un combat de boss (dès la vague 2, après un seul ennemi)
{
  const { context, page } = await openGame();
  await setConfig(page, { DIFFICULTY: { bossWaveEvery: 2, baseWaveKills: 1, waveKillsStep: 0 }, PLAYER: { startingLives: 5 } });
  await page.mouse.click(...at(240, 150));
  await page.mouse.down();
  for (let i = 0; i < 100; i++) {
    const arrived = await page.evaluate(async () => (await import("/js/main.js")).game.bossState?.arrived);
    if (arrived) break;
    await page.mouse.move(...at(110, 135 + 85 * Math.sin(i / 3)), { steps: 5 });
    await page.waitForTimeout(250);
  }
  await page.mouse.up(); // sans tirer : le boss garde tous ses points faibles
  await page.mouse.move(...at(110, 200), { steps: 10 });
  await page.waitForTimeout(3800); // quelques salves à l'écran
  await shot(page, "screenshot-boss");
  await context.close();
}

// 6. Vidéo : vingt secondes de jeu, depuis le début d'une partie
{
  const videoDir = path.join(OUT, "video-tmp");
  const { context, page } = await openGame({ recordVideo: { dir: videoDir, size: SIZE } });
  await setConfig(page, { DIFFICULTY: { baseWaveKills: 4, waveKillsStep: 1 }, PLAYER: { startingLives: 5 } });
  await play(page, 20);
  await context.close(); // la vidéo est écrite à la fermeture
  const [file] = fs.readdirSync(videoDir);
  fs.renameSync(path.join(videoDir, file), path.join(OUT, "gameplay.webm"));
  fs.rmSync(videoDir, { recursive: true });
}

await browser.close();
server.kill();
console.log(fs.readdirSync(OUT).map((f) => `${f} (${Math.round(fs.statSync(path.join(OUT, f)).size / 1000)} ko)`).join("\n"));
