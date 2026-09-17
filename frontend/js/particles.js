// Particules (explosions, étincelles, fragments) via un pool d'objets fixe
// — aucune allocation pendant la boucle de jeu, donc pas de pause GC.
import { PALETTE } from "./config.js";
import { acquireSlot } from "./pool.js";

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

export function spawnExplosion(pool, x, y, count = 10, color = PALETTE.particle) {
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

// Éclat bref et intense (cœur blanc d'une explosion) — mélangé à
// spawnExplosion() pour donner plus de "punch" aux impacts marquants sans
// devoir dessiner un système de particules séparé.
export function spawnFlashBurst(pool, x, y, count = 6) {
  spawnExplosion(pool, x, y, count, "#ffffff");
}

export function spawnSpark(pool, x, y, count = 3) {
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
