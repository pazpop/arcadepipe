// Régénère les captures d'écran, la vidéo, la couverture et la bannière itch.io du kit presse (frontend/press/).
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

// Ouvre le jeu en anglais, sans l'aide de bienvenue, le panneau de réglages ni le tir automatique.
async function openGame(contextOptions = {}) {
  const context = await browser.newContext({ viewport: SIZE, locale: "en-US", ...contextOptions });
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.evaluate(() => {
    localStorage.setItem("arcadepipe_seen_intro", "1");
    localStorage.setItem("arcadepipe_autofire", "0"); // les scènes décident quand le vaisseau tire
  });
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

// 7. Couverture pour itch.io (630x500) : le titre du jeu sur la capture du boss
{
  const { context, page } = await openGame({ viewport: { width: 1200, height: 675 } });
  const title = await page.screenshot({ clip: { x: 300, y: 96, width: 600, height: 170 } }); // titre et sous-titre
  const dataUrl = (png) => `data:image/png;base64,${png.toString("base64")}`;
  const boss = fs.readFileSync(path.join(OUT, "screenshot-boss.png"));
  const fade = "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent), linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)";
  await page.setViewportSize({ width: 630, height: 500 });
  await page.setContent(`<body style="margin:0;width:630px;height:500px;background:#05060f;overflow:hidden;position:relative;font-family:monospace">
    <img src="${dataUrl(boss)}" style="position:absolute;left:-250px;top:60px;height:520px;image-rendering:pixelated">
    <div style="position:absolute;left:0;right:0;top:0;height:230px;background:linear-gradient(to bottom, rgba(5,6,15,.96) 55%, rgba(5,6,15,0))"></div>
    <img src="${dataUrl(title)}" style="position:absolute;left:15px;top:22px;width:600px;mix-blend-mode:screen;-webkit-mask-image:${fade};-webkit-mask-composite:source-in;mask-image:${fade};mask-composite:intersect">
    <div style="position:absolute;left:0;right:0;bottom:18px;text-align:center;color:#ffe66d;font-size:19px;text-shadow:0 0 10px #ffe66d, 0 0 3px #000">FREE RETRO SPACE SHOOTER</div>
  </body>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "itch-cover.png") });
  await context.close();
}

// 8. Bannière pour itch.io (960x220) : le titre seul, sur la capture de partie
{
  const { context, page } = await openGame({ viewport: { width: 1200, height: 675 } });
  const title = await page.screenshot({ clip: { x: 300, y: 96, width: 600, height: 170 } }); // titre et sous-titre
  const dataUrl = (png) => `data:image/png;base64,${png.toString("base64")}`;
  const gameplay = fs.readFileSync(path.join(OUT, "screenshot-gameplay.png"));
  const fade = "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent), linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)";
  await page.setViewportSize({ width: 960, height: 220 });
  await page.setContent(`<body style="margin:0;width:960px;height:220px;background:#05060f;overflow:hidden;position:relative">
    <img src="${dataUrl(gameplay)}" style="position:absolute;left:0;top:-250px;width:960px;image-rendering:pixelated">
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse 45% 80% at center, rgba(5,6,15,.94) 40%, rgba(5,6,15,.2) 100%)"></div>
    <img src="${dataUrl(title)}" style="position:absolute;left:180px;top:22px;width:600px;mix-blend-mode:screen;-webkit-mask-image:${fade};-webkit-mask-composite:source-in;mask-image:${fade};mask-composite:intersect">
  </body>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "itch-banner.png") });
  await context.close();
}

await browser.close();
server.kill();
console.log(fs.readdirSync(OUT).map((f) => `${f} (${Math.round(fs.statSync(path.join(OUT, f)).size / 1000)} ko)`).join("\n"));
