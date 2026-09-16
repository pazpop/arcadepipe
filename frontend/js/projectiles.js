// Pools de projectiles alliés et ennemis. Les tirs ennemis peuvent être très
// nombreux simultanément (patterns danmaku) donc un pool généreux + aucune
// allocation par frame est important ici plus que partout ailleurs.
import { RES_W, RES_H, PALETTE } from "./config.js";

const PLAYER_POOL_SIZE = 60;
const ENEMY_POOL_SIZE = 400;

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
      turnRate: 0, // rad/s — courbe la trajectoire (tirs ennemis uniquement, voir fireEnemyBullet)
    })),
  };
}

export function createProjectiles() {
  return {
    // Les tirs du joueur voyagent toujours à l'horizontale (vy=0) — un tiret
    // allongé se distingue mieux des tirs ronds des ennemis, sans jamais
    // paraître mal orienté puisqu'il n'y a pas d'autre direction possible.
    player: makePool(PLAYER_POOL_SIZE, 1.5, PALETTE.bulletPlayer, "dash"),
    // "streak" : tiret orienté selon la vitesse propre du tir (les patterns
    // ennemis partent dans toutes les directions, contrairement au joueur).
    // Un simple point rond, sans indice de direction/vitesse, donnait
    // l'impression que les tirs "flottaient" plutôt que d'avoir un élan.
    enemy: makePool(ENEMY_POOL_SIZE, 1.6, PALETTE.bulletEnemy, "streak"),
  };
}

function spawnInto(pool, x, y, vx, vy, colorOverride = null, damage = 1, turnRate = 0) {
  for (const b of pool.items) {
    if (b.active) continue;
    b.active = true;
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.colorOverride = colorOverride;
    b.damage = damage;
    b.turnRate = turnRate;
    return b;
  }
  return null;
}

export function firePlayerBullet(projectiles, x, y, speed, damage = 1, color = null) {
  return spawnInto(projectiles.player, x, y, speed, 0, color, damage);
}

// turnRate (rad/s, optionnel) : courbe la trajectoire au lieu d'une ligne
// droite — voir patternFan/patternRing dans patterns.js. 0 par défaut
// (comportement inchangé pour patternAimed/patternSpiralStep).
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
}

function drawPool(ctx, pool) {
  ctx.save();
  for (const b of pool.items) {
    if (!b.active) continue;
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
  drawPool(ctx, projectiles.enemy);
}
