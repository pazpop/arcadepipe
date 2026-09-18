// Fond spatial parallaxe multi-couches : étoiles lentes/rapides + planètes/
// galaxies/trous noirs occasionnels.
import { RES_W, RES_H, PALETTE } from "./config.js";

// Couche rapide/opaque (alpha 0.9) retirée : gênait la lecture des tirs en combat.
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
// Teinte tirée sur tout le cercle chromatique — c'est la désaturation dans
// drawCelestial (pas une teinte réservée) qui l'empêche de se confondre avec
// un élément de gameplay : toutes les couleurs de gameplay de ce jeu sont
// pleinement saturées, donc un décor terne reste reconnaissable comme
// "arrière-plan" quelle que soit la teinte qu'il tire.
// Trou noir plus rare que galaxie/planète (silhouette la plus chargée
// visuellement des trois) — le reste se repartage entre les deux autres.
// allowBlackhole=false (menu principal, voir updateStarfield) : jamais tiré,
// sa part se redistribue simplement vers la galaxie.
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

// Court (était 8-20s) : le fond restait trop souvent totalement vide entre
// deux corps célestes — quelques secondes suffisent à ne pas donner
// l'impression qu'ils s'enchaînent sans respiration.
function nextCelestialDelay() {
  return 2 + Math.random() * 3;
}

// Décor de boss "Étoile Noire" : fixe pendant le combat, s'échappe vers la
// gauche à la victoire (triggerDeathStarLeave) — vitesse élevée pour avoir
// quitté l'écran avant la vague suivante (voir DIFFICULTY.bossWaveBreakDuration).
const DEATH_STAR_LEAVE_SPEED = 70;

export function spawnDeathStarBackdrop(field) {
  field.deathStar = {
    x: RES_W * 0.78,
    y: RES_H * 0.38,
    radius: 40 + Math.random() * 14,
    leaving: false,
    // Varie à chaque boss (teinte désaturée, tranchée optionnelle, cratère
    // déplacé) pour ne pas être identique à chaque combat.
    hue: Math.random() * 360,
    hasTrench: Math.random() < 0.6,
    trenchTilt: (Math.random() - 0.5) * 0.3,
    craterAngle: Math.random() * Math.PI * 2,
    craterDist: 0.3 + Math.random() * 0.25,
  };
}

export function triggerDeathStarLeave(field) {
  if (field.deathStar) field.deathStar.leaving = true;
}

export function createStarfield() {
  const layers = LAYERS.map((layer) => ({
    ...layer,
    stars: Array.from({ length: layer.count }, () => makeStar(layer, true)),
  }));
  return { layers, celestial: null, celestialTimer: nextCelestialDelay(), deathStar: null };
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
  if (field.deathStar) {
    if (field.deathStar.leaving) {
      field.deathStar.x -= DEATH_STAR_LEAVE_SPEED * warp * dt;
      if (field.deathStar.x < -field.deathStar.radius * 2) field.deathStar = null;
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
    ctx.strokeStyle = `hsla(${c.hue}, 18%, 80%, 0.5)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.radius * 1.5, c.radius * 0.35, -0.4, 0, Math.PI * 2);
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
    // de gaz chauffé par friction (blanc-chaud → orangé, teinte fixe : un
    // disque d'accrétion n'a rien d'aléatoire, contrairement au hue de
    // planète/galaxie ci-dessus). Le disque à plat est le motif dominant
    // (trait large, cœur blanc + halo orangé pour simuler un dégradé,
    // impossible nativement sur un tracé 2D) ; l'anneau autour du vide,
    // volontairement plus fin et discret, approxime juste la lentille
    // gravitationnelle sans dupliquer le disque en second anneau de même poids.
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
    // Toujours pleinement opaque (pas `alpha`, contrairement au disque
    // d'accrétion ci-dessus/ci-dessous) : un vide qui fondrait en transparence
    // pendant l'entrée/sortie d'écran laisserait voir le fond au travers —
    // "pas totalement noir" — alors qu'un trou noir n'a par définition rien
    // à laisser transparaître, entier ou non encore.
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
function drawDeathStar(ctx, ds) {
  const r = ds.radius;
  // Fondu seulement en sortie (fuite) : apparaît déjà "installé" au début du combat.
  const alpha = ds.leaving ? Math.max(0, Math.min(1, (ds.x + r * 1.5) / (r * 1.5))) : 1;
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  // Désaturée (S=12%) pour rester "métallique", teinte différente à chaque boss (ds.hue).
  const grad = ctx.createRadialGradient(ds.x - r * 0.3, ds.y - r * 0.3, r * 0.15, ds.x, ds.y, r);
  grad.addColorStop(0, `hsl(${ds.hue}, 12%, 42%)`);
  grad.addColorStop(0.6, `hsl(${ds.hue}, 12%, 23%)`);
  grad.addColorStop(1, `hsl(${ds.hue}, 12%, 9%)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(ds.x, ds.y, r, 0, Math.PI * 2);
  ctx.fill();
  // Tranchée équatoriale, optionnelle et légèrement inclinée (ds.hasTrench/trenchTilt).
  if (ds.hasTrench) {
    ctx.strokeStyle = `hsla(${ds.hue}, 10%, 4%, 0.75)`;
    ctx.lineWidth = Math.max(1, r * 0.045);
    ctx.beginPath();
    ctx.moveTo(ds.x - r, ds.y + r * (0.12 - ds.trenchTilt));
    ctx.lineTo(ds.x + r, ds.y + r * (0.12 + ds.trenchTilt));
    ctx.stroke();
  }
  // Cratère, position variable autour du centre (ds.craterAngle/craterDist).
  const cx = ds.x + Math.cos(ds.craterAngle) * r * ds.craterDist;
  const cy = ds.y + Math.sin(ds.craterAngle) * r * ds.craterDist;
  ctx.fillStyle = `hsla(${ds.hue}, 10%, 6%, 0.85)`;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `hsla(${ds.hue}, 15%, 40%, 0.5)`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export function drawStarfield(ctx, field, warp) {
  ctx.save();
  if (field.deathStar) drawDeathStar(ctx, field.deathStar);
  if (field.celestial) drawCelestial(ctx, field.celestial);
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
  ctx.restore();
}
