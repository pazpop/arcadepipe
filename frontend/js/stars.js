// Fond spatial parallaxe multi-couches : étoiles lentes/rapides + planètes/
// galaxies/trous noirs occasionnels.
import { RES_W, RES_H, PALETTE } from "./config.js";
import { buildSprites } from "./assets.js";

// Deux couches discrètes seulement : une couche rapide et opaque gênerait la lecture des tirs.
const LAYERS = [
  { count: 40, speedMin: 8, speedMax: 20, size: 1, alpha: 0.35 },
  { count: 35, speedMin: 25, speedMax: 55, size: 1, alpha: 0.55 },
];

// Petit groupe d'étoiles qui scintillent (luminosité qui varie dans le
// temps, positions figées) — distinct des couches de fond ci-dessus qui
// défilent mais ne scintillent jamais. Réutilisé pour le niveau bonus
// (bonusLevel.js, plus visible) et le menu principal (states/menu.js, plus
// discret) plutôt que dupliqué dans les deux.
export function createTwinkleStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * RES_W,
    y: Math.random() * RES_H,
    phase: Math.random() * Math.PI * 2,
    // Rythme propre à chaque étoile : un scintillement synchronisé
    // paraîtrait bien plus artificiel.
    speed: 2 + Math.random() * 2,
  }));
}

// Va-et-vient 0..1 (pas juste positif) : Math.sin ramené en [0,1] fait
// clignoter doucement plutôt que sauter d'un coup entre deux états.
export function drawTwinkleStars(ctx, stars, elapsed) {
  ctx.save();
  ctx.fillStyle = PALETTE.star;
  for (const s of stars) {
    ctx.globalAlpha = 0.15 + 0.5 * (0.5 + 0.5 * Math.sin(elapsed * s.speed + s.phase));
    ctx.fillRect(s.x, s.y, 1, 1);
  }
  ctx.restore();
}

function makeStar(layer, randomX) {
  return {
    x: randomX ? Math.random() * RES_W : RES_W + 4,
    y: Math.random() * RES_H,
    speed: layer.speedMin + Math.random() * (layer.speedMax - layer.speedMin),
  };
}

// Planète/galaxie occasionnelle en fond, une à la fois, fondu en entrée/sortie.
// Teinte libre : c'est la désaturation (drawCelestial) qui distingue le décor
// des couleurs de gameplay, toutes pleinement saturées.
// Trou noir plus rare (silhouette la plus chargée) ; allowBlackhole=false
// (menu principal) : sa part revient à la galaxie.
function makeCelestial(allowBlackhole) {
  const roll = Math.random();
  const type = allowBlackhole && roll < 0.12 ? "blackhole" : roll < 0.6 ? "galaxy" : "planet";
  const radius =
    type === "blackhole" ? 28 + Math.random() * 20 : type === "galaxy" ? 26 + Math.random() * 18 : 12 + Math.random() * 22;
  return {
    type,
    x: RES_W + radius + 20,
    y: radius + Math.random() * (RES_H - radius * 2),
    radius,
    speed: 1.5 + Math.random() * 3, // lent (vs étoiles) pour rester "loin" visuellement
    hue: Math.random() * 360,
    // Disque d'accrétion : toujours blanc-chaud/orangé (chauffé par friction),
    // jamais une teinte aléatoire comme planète/galaxie — sinon ça ressemble à
    // un néon plutôt qu'à de la matière en fusion.
    hotHue: 15 + Math.random() * 35,
    rotation: Math.random() * Math.PI * 2,
  };
}

// Délai court entre deux corps célestes : le fond n'est jamais vide longtemps,
// sans qu'ils s'enchaînent sans respiration.
function nextCelestialDelay() {
  return 2 + Math.random() * 3;
}

// Décor de boss : le vaisseau-mère de la flotte ennemie, une très grande
// silhouette sombre derrière le combat. Immobile pendant le combat, il s'échappe
// vers la gauche à la victoire (triggerBossBackdropLeave), assez vite pour avoir
// quitté l'écran avant la vague suivante (DIFFICULTY.bossWaveBreakDuration).
const BOSS_BACKDROP_LEAVE_SPEED = 90;

export function spawnBossBackdrop(field) {
  field.bossBackdrop = {
    x: RES_W * (0.74 + Math.random() * 0.08),
    y: RES_H * (0.3 + Math.random() * 0.12),
    scale: 4 + Math.random(), // fois la taille de la coque du boss ; varie à chaque combat
    leaving: false,
  };
}

export function triggerBossBackdropLeave(field) {
  if (field.bossBackdrop) field.bossBackdrop.leaving = true;
}

export function createStarfield() {
  const layers = LAYERS.map((layer) => ({
    ...layer,
    stars: Array.from({ length: layer.count }, () => makeStar(layer, true)),
  }));
  return { layers, celestial: null, celestialTimer: nextCelestialDelay(), bossBackdrop: null };
}

// allowBlackhole : false pour ne jamais en tirer un nouveau (menu principal,
// voir game.js) — un trou noir déjà en train de traverser l'écran continue
// sa traversée (pas de retrait rétroactif), seul un NOUVEAU tirage en tient compte.
export function updateStarfield(field, dt, warp, allowBlackhole = true) {
  for (const layer of field.layers) {
    for (const st of layer.stars) {
      st.x -= st.speed * warp * dt;
      if (st.x < -4) Object.assign(st, makeStar(layer, false));
    }
  }
  if (field.celestial) {
    field.celestial.x -= field.celestial.speed * warp * dt;
    if (field.celestial.x < -field.celestial.radius * 3) {
      field.celestial = null;
      field.celestialTimer = nextCelestialDelay();
    }
  } else {
    field.celestialTimer -= dt;
    if (field.celestialTimer <= 0) field.celestial = makeCelestial(allowBlackhole);
  }
  if (field.bossBackdrop) {
    if (field.bossBackdrop.leaving) {
      field.bossBackdrop.x -= BOSS_BACKDROP_LEAVE_SPEED * warp * dt;
      if (field.bossBackdrop.x < -RES_W / 2) field.bossBackdrop = null;
    }
    // Sinon : immobile pendant le combat (dériver distrairait plus qu'autre chose).
  }
}

// Fondu basé sur la distance aux bords (pas un minuteur) : reste cohérent
// quel que soit le warp.
function celestialAlpha(c) {
  const fadeDist = c.radius * 2.5;
  const fadeIn = Math.min(1, (RES_W + c.radius - c.x) / fadeDist);
  const fadeOut = Math.min(1, (c.x + c.radius) / fadeDist);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

function drawCelestial(ctx, c) {
  const alpha = celestialAlpha(c);
  if (alpha <= 0.01) return;
  ctx.save();
  if (c.type === "planet") {
    ctx.globalAlpha = alpha * 0.5; // discret, pour rester "loin"
    const ringRx = c.radius * 1.5;
    const ringRy = c.radius * 0.35;
    const ringRotation = -0.4;
    ctx.strokeStyle = `hsla(${c.hue}, 18%, 80%, 0.5)`;
    ctx.lineWidth = 1.5;
    // Anneau en deux moitiés (avant/arrière la sphère) plutôt qu'un tracé
    // complet en un seul passage : un anneau plein passerait "devant" sur
    // tout son pourtour, y compris la moitié qui doit disparaître derrière
    // la planète — la coupure à t=0/π est symétrique par rapport au centre
    // de l'ellipse, donc correcte quelle que soit l'inclinaison (rotation).
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, ringRx, ringRy, ringRotation, 0, Math.PI);
    ctx.stroke();

    const grad = ctx.createRadialGradient(
      c.x - c.radius * 0.3, c.y - c.radius * 0.3, c.radius * 0.1,
      c.x, c.y, c.radius
    );
    grad.addColorStop(0, `hsl(${c.hue}, 28%, 65%)`);
    grad.addColorStop(1, `hsl(${c.hue}, 22%, 22%)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(c.x, c.y, ringRx, ringRy, ringRotation, Math.PI, Math.PI * 2);
    ctx.stroke();
  } else if (c.type === "galaxy") {
    ctx.globalAlpha = alpha * 0.35; // discret, pour rester "loin"
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rotation);
    ctx.scale(1, 0.35);
    // Dégradé en espace local (après transform) pour rester centré malgré
    // rotation/scale.
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, c.radius);
    grad.addColorStop(0, `hsla(${c.hue}, 32%, 85%, 0.9)`);
    grad.addColorStop(0.4, `hsla(${c.hue}, 26%, 60%, 0.5)`);
    grad.addColorStop(1, `hsla(${c.hue}, 20%, 40%, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Trou noir façon Gargantua (Interstellar) : un vide entouré d'un disque
    // de gaz chaud, à plat (trait large orangé, cœur blanc par-dessus), et d'un
    // anneau plus fin autour du vide pour la lentille gravitationnelle.
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rotation);

    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = `hsl(${c.hotHue}, 90%, 50%)`;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = c.radius * 0.4;
    ctx.lineWidth = c.radius * 0.3;
    ctx.beginPath();
    ctx.ellipse(0, 0, c.radius * 1.75, c.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.85;
    ctx.shadowBlur = c.radius * 0.15;
    ctx.strokeStyle = `hsl(${c.hotHue + 20}, 100%, 85%)`;
    ctx.lineWidth = c.radius * 0.08;
    ctx.stroke();

    ctx.shadowBlur = 0;
    // Le vide reste opaque, même pendant le fondu d'entrée et de sortie du disque.
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = `hsl(${c.hotHue}, 80%, 60%)`;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = c.radius * 0.2;
    ctx.lineWidth = c.radius * 0.05;
    ctx.beginPath();
    ctx.ellipse(0, 0, c.radius * 1.08, c.radius * 1.0, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Silhouette dessinée au canvas (pas un sprite), cohérent avec planètes/
// galaxies ci-dessus. Teintes grises très désaturées (S=12%, même principe
// que drawCelestial : jamais assez vif pour rivaliser avec le gameplay).
// Silhouette du vaisseau-mère : la coque du boss (sprite d'assets.js), assombrie
// jusqu'à n'être presque plus qu'une ombre, mais opaque pour cacher ce qui
// passe derrière. Préparée une fois, hors de l'écran.
let mothership = null;
function mothershipSprite() {
  if (mothership) return mothership;
  const hull = buildSprites().bossHull;
  mothership = document.createElement("canvas");
  mothership.width = hull.width;
  mothership.height = hull.height;
  const ctx = mothership.getContext("2d");
  ctx.drawImage(hull, 0, 0);
  ctx.globalCompositeOperation = "source-atop"; // ne peint que sur les pixels de la coque
  ctx.fillStyle = "rgba(5, 6, 15, 0.8)";
  ctx.fillRect(0, 0, hull.width, hull.height);
  return mothership;
}

function drawBossBackdrop(ctx, backdrop) {
  const sprite = mothershipSprite();
  const w = sprite.width * backdrop.scale;
  const h = sprite.height * backdrop.scale;
  ctx.save();
  // Fondu seulement en sortie : il est déjà là au début du combat.
  ctx.globalAlpha = backdrop.leaving ? Math.max(0, Math.min(1, (backdrop.x + w / 2) / w)) : 1;
  ctx.drawImage(sprite, backdrop.x - w / 2, backdrop.y - h / 2, w, h);
  ctx.restore();
}

// Décor, du plus lointain au plus proche : les étoiles, puis une planète (ou
// galaxie, trou noir), puis le vaisseau-mère des combats de boss. Le jeu
// lui-même est dessiné ensuite, par-dessus (game.js).
export function drawStarfield(ctx, field, warp) {
  ctx.save();
  ctx.fillStyle = PALETTE.star;
  for (const layer of field.layers) {
    ctx.globalAlpha = layer.alpha;
    for (const st of layer.stars) {
      const streak = Math.min(18, st.speed * warp * 0.03);
      if (streak > 1.2) {
        ctx.fillRect(st.x, st.y, streak + layer.size, layer.size);
      } else {
        ctx.fillRect(st.x, st.y, layer.size, layer.size);
      }
    }
  }
  ctx.globalAlpha = 1;
  if (field.celestial) drawCelestial(ctx, field.celestial);
  if (field.bossBackdrop) drawBossBackdrop(ctx, field.bossBackdrop);
  ctx.restore();
}
