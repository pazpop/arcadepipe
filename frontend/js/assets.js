// Sprites pixel art générés par code — matrice de caractères (lettre =
// couleur, "." = transparent), convertie une fois en canvas offscreen puis
// blittée (drawImage) à chaque frame.
import { desaturate } from "./color.js";

function pixelsToCanvas(rows, palette, scale = 1) {
  const h = rows.length;
  const w = rows[0].length;
  const off = document.createElement("canvas");
  off.width = w * scale;
  off.height = h * scale;
  const ctx = off.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      if (c === "." || !palette[c]) continue;
      ctx.fillStyle = palette[c];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return off;
}

// --- Vaisseau du joueur : chasseur trapu, nez à DROITE (sens du tir),
// plaques d'armure marquées et tuyère large pour une impression de puissance.
const PLAYER_ROWS = [
  ".......................",
  "......aaaa.............",
  "......aaaaaaa..........",
  "...aaaabbbbbbbbb.......",
  "...bbbfffffffbbbbba....",
  "eeeaaffffbbbbccccbbba..",
  "eeeaabbbbbbffddddffbbbc",
  "eeeaaffffbbbbccccbbba..",
  "...bbbfffffffbbbbba....",
  "...aaaabbbbbbbbb.......",
  "......aaaaaaa..........",
  "......aaaa.............",
  ".......................",
];
const PLAYER_PALETTE = {
  a: "#0f5068", // coque, ombre
  b: "#1f8fb0", // coque, base
  c: "#8ef4ff", // verrière, reflet
  d: "#c9fbff", // cockpit
  e: "#ffd27a", // tuyère (arrière, chaude)
  f: "#2ec4ff", // liseré d'armure, accent vif
};

// --- Ennemi normal : chasseur trapu vert (palier "facile"), cockpit + tuyère ---
const ENEMY_NORMAL_ROWS = [
  "...............",
  "......aaa......",
  "....abbbbaa....",
  "..abbbbcbbaa...",
  "cbbddbbbbbaaeee",
  "..abbbbcbbaa...",
  "....abbbbaa....",
  "......aaa......",
  "...............",
];
const ENEMY_NORMAL_PALETTE = {
  a: "#13712b",
  b: "#27be4d",
  c: "#99ffb3",
  d: "#7de0ff",
  e: "#ffb347",
};

// Même silhouette que l'ennemi normal (ENEMY_NORMAL_ROWS) — seule la palette
// change (bleu-indigo au lieu de vert, assorti à ses propres tirs), pour
// signaler le palier "moyen" (variante qui tire aussi, voir GUNNER_MIN_WAVE
// dans enemies.js) sans redessiner une forme.
const ENEMY_GUNNER_PALETTE = {
  a: "#132871",
  b: "#2748be",
  c: "#99afff",
  d: "#7de0ff",
  e: "#ffb347",
};

// --- Ennemi élite : violet, silhouette plus longue et effilée ---
const ENEMY_ELITE_ROWS = [
  "...............",
  ".......aaa.....",
  ".....bbbbbb....",
  "...abbbbbbaaa..",
  "..abbbbbbcbbb..",
  "cbbddbbbbbbaaee",
  "..abbbbbbcbbb..",
  "...abbbbbbaaa..",
  ".....bbbbbb....",
  ".......aaa.....",
  "...............",
];
const ENEMY_ELITE_PALETTE = {
  a: "#4a1060",
  b: "#a04fe0",
  c: "#f0d0ff",
  d: "#7de0ff",
  e: "#ffb347",
};

// --- Ennemi kamikaze : dard rouge fin, pointe à DROITE (voir la rotation
// dans drawEnemies, enemies.js — orienté selon sa vitesse réelle, contrairement
// aux autres ennemis qui restent fixes). Queue "e" = tuyère, comme les autres
// vaisseaux ; pointe "c" quasi blanche, la partie qui fonce sur le joueur.
const ENEMY_KAMIKAZE_ROWS = [
  "...............",
  "..........a....",
  "........aabb...",
  "......aabbbbc..",
  "eee.aabbbbbbbcc",
  "......aabbbbc..",
  "........aabb...",
  "..........a....",
  "...............",
];
const ENEMY_KAMIKAZE_PALETTE = {
  a: "#7a1220",
  b: "#ff5d73", // même rouge que PALETTE.danger (config.js) — cohérent avec l'urgence qu'il signale
  c: "#ffd0d6",
  e: "#ffb347",
};

// --- Coque du boss : coin triangulaire générique (large à l'arrière, effilé
// à l'avant face au joueur) — trope SF générique, pas de détails copiés.
// Superstructure (s) décalée pour casser la symétrie.
const BOSS_HULL_ROWS = [
  ".............................a",
  ".........................aaaaa",
  "....................aaaaaaaaaa",
  "................bbbssssssssbbb",
  "...........ccccccccssssssssccc",
  ".......ccccccccccccssssssssccc",
  "...ddddddddddddddddddddddddddd",
  "eeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "eeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "...ddddddddddddddddddddddddddd",
  ".......ccccccccccccccccccccccc",
  "...........ccccccccccccccccccc",
  "................bbbbbbbbbbbbbb",
  "....................aaaaaaaaaa",
  ".........................aaaaa",
  ".............................a",
];
const BOSS_HULL_PALETTE = {
  a: "#23232c", // contour extérieur, sombre
  b: "#3c3c48", // plaques externes
  c: "#5a5a68", // plaques, reflet
  d: "#33465e", // bande intermédiaire, bleu-acier froid
  e: "#4d6a86", // colonne centrale — froide, pour ne jamais se confondre avec le jaune des points faibles
  s: "#1c2430", // superstructure/pont, la plus sombre — casse la symétrie
};

// Désature chaque couleur d'une palette (voir desaturate dans color.js) —
// utilisé pour générer la variante "endommagée" d'un sprite sans dupliquer
// sa palette à la main.
function fadedPalette(palette) {
  const out = {};
  for (const key in palette) out[key] = desaturate(palette[key], 0.45);
  return out;
}

let cache = null;

export function buildSprites() {
  if (cache) return cache;
  cache = {
    player: pixelsToCanvas(PLAYER_ROWS, PLAYER_PALETTE, 1),
    enemyNormal: pixelsToCanvas(ENEMY_NORMAL_ROWS, ENEMY_NORMAL_PALETTE, 1),
    enemyGunner: pixelsToCanvas(ENEMY_NORMAL_ROWS, ENEMY_GUNNER_PALETTE, 1),
    // Variantes "endommagées" (couleurs ternies) : gunner et élite encaissent
    // plus d'un coup (voir GUNNER_HP_BONUS et TYPE_STATS.elite dans
    // enemies.js) — un seul palier visuel dès le premier coup pris plutôt
    // qu'un dégradé par PV, largement suffisant vu leur nombre de PV réduit
    // (2 et 3) et plus simple à suivre du coin de l'œil en plein combat.
    enemyGunnerDamaged: pixelsToCanvas(ENEMY_NORMAL_ROWS, fadedPalette(ENEMY_GUNNER_PALETTE), 1),
    enemyElite: pixelsToCanvas(ENEMY_ELITE_ROWS, ENEMY_ELITE_PALETTE, 1),
    enemyEliteDamaged: pixelsToCanvas(ENEMY_ELITE_ROWS, fadedPalette(ENEMY_ELITE_PALETTE), 1),
    enemyKamikaze: pixelsToCanvas(ENEMY_KAMIKAZE_ROWS, ENEMY_KAMIKAZE_PALETTE, 1),
    bossHull: pixelsToCanvas(BOSS_HULL_ROWS, BOSS_HULL_PALETTE, 2),
  };
  return cache;
}

// Halo simulé par un double tracé translucide (pas de vrai flou) : sprite agrandi et transparent en dessous.
export function drawWithGlow(ctx, sprite, x, y, glowColor, glowAlpha = 0.35) {
  const w = sprite.width;
  const h = sprite.height;
  ctx.save();
  ctx.globalAlpha = glowAlpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(sprite, x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2);
  ctx.restore();
  ctx.drawImage(sprite, x - w / 2, y - h / 2, w, h);
}
