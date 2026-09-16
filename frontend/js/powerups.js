// Bonus temporaires : lâchés occasionnellement par les ennemis détruits,
// dérivent lentement, disparaissent si non ramassés. Pool fixe, même
// pattern que particles.js/projectiles.js.
import { RES_H, POWERUP } from "./config.js";

const POOL_SIZE = 8;

export function createPowerupPool() {
  return {
    items: Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      type: "power",
      x: 0,
      y: 0,
      elapsed: 0,
    })),
  };
}

export function spawnPowerup(pool, x, y, type) {
  for (const p of pool.items) {
    if (p.active) continue;
    p.active = true;
    p.type = type;
    p.x = x;
    p.y = y;
    p.elapsed = 0;
    return p;
  }
  return null; // pool saturé (rare avec 8 emplacements) : on ignore silencieusement
}

export function updatePowerups(pool, dt) {
  for (const p of pool.items) {
    if (!p.active) continue;
    p.elapsed += dt;
    p.x -= POWERUP.fallSpeed * dt;
    p.y += Math.sin(p.elapsed * 3) * 10 * dt; // léger flottement, plus visible qu'une dérive rectiligne
    if (p.elapsed > POWERUP.lifetime || p.x < -10 || p.y < -10 || p.y > RES_H + 10) {
      p.active = false;
    }
  }
}

export function drawPowerups(ctx, pool) {
  for (const p of pool.items) {
    if (!p.active) continue;
    const def = POWERUP.types[p.type];
    // Clignote juste avant d'expirer pour prévenir que la fenêtre se referme.
    const remaining = POWERUP.lifetime - p.elapsed;
    const alpha = remaining < 2 ? 0.4 + 0.6 * (Math.sin(p.elapsed * 16) * 0.5 + 0.5) : 1;
    const pulse = 1 + Math.sin(p.elapsed * 5) * 0.15;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = def.color;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 6;
    const r = POWERUP.radius * pulse;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
}
