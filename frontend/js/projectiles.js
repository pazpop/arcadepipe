// Pools de projectiles alliés et ennemis. Les tirs ennemis peuvent être très
// nombreux simultanément (patterns danmaku) donc un pool généreux + aucune
// allocation par frame est important ici plus que partout ailleurs.
import { RES_W, RES_H, PALETTE } from "./config.js";
import { acquireSlot } from "./pool.js";

const PLAYER_POOL_SIZE = 60;
const ENEMY_POOL_SIZE = 400;
const PELLET_POOL_SIZE = 40;

// Durée de la courbe d'un tir ennemi, en secondes. Limitée : un tir qui
// tournerait sans fin décrirait un cercle et ne quitterait jamais l'écran.
const CURVE_DURATION = 1;

function makePool(size, radius, color, shape) {
  return {
    radius,
    color,
    shape,
    items: Array.from({ length: size }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      colorOverride: null,
      damage: 1,
      maxDamage: 0, // >0 seulement pour les plombs (dégâts décroissants) — voir firePlayerPellets/updateProjectiles/drawPool
      turnRate: 0, // rad/s — courbe la trajectoire (tirs ennemis uniquement, voir fireEnemyBullet)
      turnTime: 0, // secondes de courbe restantes : ensuite le tir file droit
      grazed: false, // pool ennemi uniquement (voir graze.js) — un tir ne graze qu'une fois pendant toute sa vie
    })),
  };
}

export function createProjectiles() {
  return {
    // Tirs du joueur toujours à l'horizontale (vy=0) — un tiret allongé se
    // distingue mieux des tirs ronds ennemis.
    player: makePool(PLAYER_POOL_SIZE, 1.5, PALETTE.bulletPlayer, "dash"),
    // "streak" : tiret orienté selon la vitesse du tir, qui montre sa direction.
    enemy: makePool(ENEMY_POOL_SIZE, 1.6, PALETTE.bulletEnemy, "streak"),
    // Plombs du bonus CHEVROTINE (config.js) : forme "dot" (pas de rotation
    // nécessaire, contrairement à "dash"/"streak") puisqu'ils partent en
    // éventail plutôt qu'à l'horizontale — voir firePlayerPellets ci-dessous.
    pellet: makePool(PELLET_POOL_SIZE, 1.2, null, "dot"),
  };
}

function spawnInto(pool, x, y, vx, vy, colorOverride, damage, turnRate = 0) {
  const b = acquireSlot(pool);
  if (!b) return null;
  b.active = true;
  b.x = x;
  b.y = y;
  b.vx = vx;
  b.vy = vy;
  b.colorOverride = colorOverride;
  b.damage = damage;
  b.turnRate = turnRate;
  b.turnTime = CURVE_DURATION;
  b.grazed = false;
  return b;
}

export function firePlayerBullet(projectiles, x, y, speed, damage, color) {
  spawnInto(projectiles.player, x, y, speed, 0, color, damage);
}

// Dégâts perdus par seconde de vol — avec `damage` initial (POWERUP.types.shotgun),
// un plomb s'éteint en ~0.62s, soit ~160px à bulletSpeed (voir PLAYER.bulletSpeed,
// un peu plus du tiers de l'écran) : fort à bout portant, négligeable au-delà.
const PELLET_DAMAGE_DECAY = 3;

// Cône de plombs (bonus CHEVROTINE) : PELLET_COUNT plombs répartis sur
// PELLET_SPREAD radians autour de l'axe horizontal. Dégâts décroissants gérés
// dans updateProjectiles ; le fondu visuel (drawPool) suit la même valeur,
// donc toujours synchronisé avec la perte de puissance réelle.
const PELLET_COUNT = 6;
const PELLET_SPREAD = Math.PI / 4;

export function firePlayerPellets(projectiles, x, y, speed, damage, color) {
  for (let i = 0; i < PELLET_COUNT; i++) {
    const a = -PELLET_SPREAD / 2 + (PELLET_SPREAD * i) / (PELLET_COUNT - 1);
    const p = spawnInto(projectiles.pellet, x, y, Math.cos(a) * speed, Math.sin(a) * speed, color, damage);
    if (p) p.maxDamage = damage;
  }
}

// turnRate (rad/s, optionnel) : courbe la trajectoire (patternFan/patternRing)
// pendant CURVE_DURATION secondes.
export function fireEnemyBullet(projectiles, x, y, vx, vy, color = null, turnRate = 0) {
  spawnInto(projectiles.enemy, x, y, vx, vy, color, 1, turnRate);
}

export function updateProjectiles(projectiles, dt) {
  for (const b of projectiles.player.items) {
    if (!b.active) continue;
    b.x += b.vx * dt; // toujours à l'horizontale
    if (b.x > RES_W + 10) b.active = false;
  }
  for (const b of projectiles.enemy.items) {
    if (!b.active) continue;
    if (b.turnRate && b.turnTime > 0) {
      b.turnTime -= dt;
      const speed = Math.hypot(b.vx, b.vy);
      const angle = Math.atan2(b.vy, b.vx) + b.turnRate * dt;
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -10 || b.x > RES_W + 10 || b.y < -10 || b.y > RES_H + 10) b.active = false;
  }
  for (const p of projectiles.pellet.items) {
    if (!p.active) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.damage -= PELLET_DAMAGE_DECAY * dt;
    // Le seuil (pas 0 pile) évite un plomb qui traîne en faisant un dégât
    // quasi nul juste avant de s'éteindre.
    if (p.damage <= 0.15 || p.x < -10 || p.x > RES_W + 10 || p.y < -10 || p.y > RES_H + 10) {
      p.active = false;
    }
  }
}

// Dessine un tir, élargi de `grow` pixels de chaque côté.
function drawShape(ctx, pool, b, grow) {
  if (pool.shape === "dot") {
    ctx.beginPath();
    ctx.arc(b.x, b.y, pool.radius + grow, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // "dash" : tiret horizontal ; "streak" : tiret orienté selon la vitesse du tir.
  const w = pool.radius * (pool.shape === "dash" ? 3.2 : 2.8) + grow * 2;
  const h = pool.radius * (pool.shape === "dash" ? 1.3 : 1.2) + grow * 2;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (pool.shape === "streak") ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawPool(ctx, pool) {
  ctx.save();
  for (const b of pool.items) {
    if (!b.active) continue;
    // Fondu synchronisé avec la perte de dégâts (plombs uniquement — les
    // autres tirs ont maxDamage=0, donc alpha reste à 1).
    const alpha = b.maxDamage > 0 ? Math.max(0.12, b.damage / b.maxDamage) : 1;
    ctx.fillStyle = b.colorOverride || pool.color;
    // Halo : la même forme, plus large et translucide, sous le tir. Un vrai
    // flou (shadowBlur) par tir coûte trop cher quand l'écran en est plein.
    ctx.globalAlpha = alpha * 0.35;
    drawShape(ctx, pool, b, 1.2);
    ctx.globalAlpha = alpha;
    drawShape(ctx, pool, b, 0);
  }
  ctx.restore();
}

export function drawProjectiles(ctx, projectiles) {
  drawPool(ctx, projectiles.player);
  drawPool(ctx, projectiles.pellet);
  drawPool(ctx, projectiles.enemy);
}
