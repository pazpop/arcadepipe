// Bonus temporaires : lâchés occasionnellement par les ennemis détruits,
// dérivent lentement, disparaissent si non ramassés. Pool fixe, même
// pattern que particles.js/projectiles.js.
import { RES_H, POWERUP } from "./config.js";
import { acquireSlot } from "./pool.js";

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
  const p = acquireSlot(pool); // pool saturé (rare avec 8 emplacements) : ignoré silencieusement
  if (!p) return null;
  p.active = true;
  p.type = type;
  p.x = x;
  p.y = y;
  p.elapsed = 0;
  return p;
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

// Losange coloré (couleur de POWERUP.types[type]) — le même dessin sert au
// bonus qui tombe en jeu (drawPowerups ci-dessous) et à sa légende dans le
// menu Aide (voir drawInfoScreen dans hud.js), pour garantir qu'ils restent
// visuellement identiques sans dupliquer le dessin.
export function drawPowerupIcon(ctx, x, y, type, size = POWERUP.radius) {
  const def = POWERUP.types[type];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = def.color;
  ctx.shadowColor = def.color;
  ctx.shadowBlur = 6;
  ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.restore();
}

export function drawPowerups(ctx, pool) {
  for (const p of pool.items) {
    if (!p.active) continue;
    // Clignote juste avant d'expirer pour prévenir que la fenêtre se referme.
    const remaining = POWERUP.lifetime - p.elapsed;
    const alpha = remaining < 2 ? 0.4 + 0.6 * (Math.sin(p.elapsed * 16) * 0.5 + 0.5) : 1;
    const pulse = 1 + Math.sin(p.elapsed * 5) * 0.15;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawPowerupIcon(ctx, p.x, p.y, p.type, POWERUP.radius * pulse);
    ctx.restore();
  }
}
