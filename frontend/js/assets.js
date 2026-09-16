// Sprites pixel art générés par code (aucun fichier image externe).
// Chaque sprite est une matrice de caractères (une lettre = une couleur de
// la palette locale, "." = transparent), convertie une seule fois en canvas
// offscreen au chargement puis simplement blittée (drawImage) à chaque frame
// — bien moins coûteux que de retracer des dizaines de fillRect par sprite.

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

// --- Vaisseau du joueur : chasseur trapu, nez à DROITE (sens du tir).
// Plus grand et plus large que la version précédente (silhouette fine en
// dard, jugée trop "fragile") — plaques d'armure marquées (liseré bleu vif)
// et tuyère large pour donner une impression de puissance.
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

// --- Ennemi normal : chasseur trapu rouge/rose, cockpit + tuyère ---
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
  a: "#7a1220",
  b: "#c62a3f",
  c: "#ff8fa3",
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

// --- Coque du boss : vaisseau capital générique en forme de coin
// triangulaire (large à l'arrière/droite, effilé en pointe à l'avant/
// gauche, face au joueur) — silhouette de vaisseau de guerre massif, un
// trope générique de SF (pas de logo, pas de proportions ni de détails
// copiés d'une œuvre existante). Bandes longitudinales façon plaques de
// coque + une légère superstructure (s) décalée vers l'arrière, pas
// centrée, pour casser la symétrie sans dessiner une vraie tour détaillée.
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
  e: "#4d6a86", // colonne centrale — délibérément froide pour ne jamais se
  // confondre avec le jaune vif des points faibles (PALETTE.bossWeakOn)
  s: "#1c2430", // superstructure/pont, la plus sombre — casse la symétrie
};

let cache = null;

export function buildSprites() {
  if (cache) return cache;
  cache = {
    player: pixelsToCanvas(PLAYER_ROWS, PLAYER_PALETTE, 1),
    enemyNormal: pixelsToCanvas(ENEMY_NORMAL_ROWS, ENEMY_NORMAL_PALETTE, 1),
    enemyElite: pixelsToCanvas(ENEMY_ELITE_ROWS, ENEMY_ELITE_PALETTE, 1),
    bossHull: pixelsToCanvas(BOSS_HULL_ROWS, BOSS_HULL_PALETTE, 2),
  };
  return cache;
}

// Halo lumineux simulé par un double tracé translucide (pas de vrai flou
// coûteux) : dessine le sprite légèrement agrandi et transparent en dessous.
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
