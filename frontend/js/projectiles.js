// Pools de projectiles alliés et ennemis. Les tirs ennemis peuvent être très
// nombreux simultanément (patterns danmaku) donc un pool généreux + aucune
// allocation par frame est important ici plus que partout ailleurs.
import { RES_W, RES_H, PALETTE } from "./config.js";
import { acquireSlot } from "./pool.js";

const PLAYER_POOL_SIZE = 60;
const ENEMY_POOL_SIZE = 400;
const PELLET_POOL_SIZE = 40;

function makePool(size, radius, color, shape = "dot") {
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
      grazed: false, // pool ennemi uniquement (voir graze.js) — un tir ne graze qu'une fois pendant toute sa vie
    })),
  };
}

export function createProjectiles() {
  return {
    // Tirs du joueur toujours à l'horizontale (vy=0) — un tiret allongé se
    // distingue mieux des tirs ronds ennemis.
    player: makePool(PLAYER_POOL_SIZE, 1.5, PALETTE.bulletPlayer, "dash"),
    // "streak" : tiret orienté selon la vitesse du tir (patterns ennemis
    // multi-directionnels) — un point rond donnait l'impression de "flotter".
    enemy: makePool(ENEMY_POOL_SIZE, 1.6, PALETTE.bulletEnemy, "streak"),
    // Plombs du bonus CHEVROTINE (config.js) : forme "dot" (pas de rotation
    // nécessaire, contrairement à "dash"/"streak") puisqu'ils partent en
    // éventail plutôt qu'à l'horizontale — voir firePlayerPellets ci-dessous.
    pellet: makePool(PELLET_POOL_SIZE, 1.2, null, "dot"),
  };
}

function spawnInto(pool, x, y, vx, vy, colorOverride = null, damage = 1, turnRate = 0) {
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
  b.grazed = false;
  return b;
}

export function firePlayerBullet(projectiles, x, y, speed, damage = 1, color = null) {
  return spawnInto(projectiles.player, x, y, speed, 0, color, damage);
}

// Dégâts perdus par seconde de vol — avec `damage` initial (POWERUP.types.shotgun),
// un plomb s'éteint en ~0.67s, soit ~170px à bulletSpeed (voir PLAYER.bulletSpeed,
// un peu plus du tiers de l'écran) : fort à bout portant, négligeable au-delà.
const PELLET_DAMAGE_DECAY = 3;

// Cône de plombs (bonus CHEVROTINE) : `count` plombs répartis sur `spreadRad`
// radians autour de l'axe horizontal. Dégâts décroissants gérés dans
// updateProjectiles ; le fondu visuel (drawPool) suit la même valeur, donc
// toujours synchronisé avec la perte de puissance réelle.
export function firePlayerPellets(projectiles, x, y, speed, damage, color, count = 6, spreadRad = Math.PI / 4) {
  const start = -spreadRad / 2;
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? 0 : start + (spreadRad * i) / (count - 1);
    const p = acquireSlot(projectiles.pellet);
    if (!p) continue;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.colorOverride = color;
    p.damage = damage;
    p.maxDamage = damage;
    p.turnRate = 0;
  }
}

// turnRate (rad/s, optionnel) : courbe la trajectoire (patternFan/patternRing). 0 par défaut.
export function fireEnemyBullet(projectiles, x, y, vx, vy, color = null, turnRate = 0) {
  return spawnInto(projectiles.enemy, x, y, vx, vy, color, 1, turnRate);
}

export function updateProjectiles(projectiles, dt) {
  for (const b of projectiles.player.items) {
    if (!b.active) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x > RES_W + 10) b.active = false;
  }
  for (const b of projectiles.enemy.items) {
    if (!b.active) continue;
    if (b.turnRate) {
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

function drawPool(ctx, pool) {
  ctx.save();
  for (const b of pool.items) {
    if (!b.active) continue;
    // Fondu synchronisé avec la perte de dégâts (plombs uniquement — les
    // autres tirs ont maxDamage=0, donc alpha reste à 1).
    ctx.globalAlpha = b.maxDamage > 0 ? Math.max(0.12, b.damage / b.maxDamage) : 1;
    ctx.fillStyle = b.colorOverride || pool.color;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 4;
    if (pool.shape === "dash") {
      const w = pool.radius * 3.2;
      const h = pool.radius * 1.3;
      ctx.fillRect(b.x - w / 2, b.y - h / 2, w, h);
    } else if (pool.shape === "streak") {
      const w = pool.radius * 2.8;
      const h = pool.radius * 1.2;
      const angle = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(b.x, b.y, pool.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawProjectiles(ctx, projectiles) {
  drawPool(ctx, projectiles.player);
  drawPool(ctx, projectiles.pellet);
  drawPool(ctx, projectiles.enemy);
}
