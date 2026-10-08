// Particules (explosions, étincelles) dans un pool d'objets fixe, réutilisés.
import { PALETTE } from "./config.js";
import { acquireSlot } from "./pool.js";
import { desaturate } from "./color.js";

const POOL_SIZE = 400;

export function createParticlePool() {
  const items = Array.from({ length: POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    size: 2,
    color: PALETTE.particle,
  }));
  return { items };
}

function spawnOne(pool, x, y, vx, vy, life, size, color) {
  const p = acquireSlot(pool);
  if (!p) return;
  p.active = true;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = vy;
  p.life = life;
  p.maxLife = life;
  p.size = size;
  p.color = color;
}

// Couleur ternie : les couleurs de gameplay sont saturées, une particule ne
// doit jamais se confondre avec un tir à esquiver.
export function spawnExplosion(pool, x, y, count, color) {
  color = desaturate(color);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 110;
    spawnOne(
      pool,
      x,
      y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      0.32 + Math.random() * 0.32,
      1.2 + Math.random() * 2.2,
      color
    );
  }
}

// Cœur blanc d'une explosion, pour les impacts marquants.
export function spawnFlashBurst(pool, x, y, count) {
  spawnExplosion(pool, x, y, count, "#ffffff");
}

export function spawnSpark(pool, x, y, count) {
  spawnExplosion(pool, x, y, count, PALETTE.hud);
}

export function updateParticles(pool, dt) {
  for (const p of pool.items) {
    if (!p.active) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) p.active = false;
  }
}

export function drawParticles(ctx, pool) {
  ctx.save();
  for (const p of pool.items) {
    if (!p.active) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}
