// Patterns de tirs ennemis réutilisables : éventail, spirale, tir visé.
// Chaque pattern reçoit (projectiles, x, y, elapsed, target, speedMul) et se
// charge lui-même de peupler le pool de tirs ennemis.
import { fireEnemyBullet } from "./projectiles.js";
import { PALETTE } from "./config.js";

export function patternAimed(projectiles, x, y, target, speed, color = null) {
  const dx = target.x - x;
  const dy = target.y - y;
  const dist = Math.hypot(dx, dy) || 1;
  fireEnemyBullet(projectiles, x, y, (dx / dist) * speed, (dy / dist) * speed, color);
}

// curve (rad/s, optionnel) : les tirs aux extrémités de l'éventail
// s'incurvent vers l'extérieur (le centre reste droit) — donne un effet de
// "fleur qui s'ouvre" au lieu de rayons parfaitement rectilignes.
export function patternFan(projectiles, x, y, target, speed, count = 5, spreadRad = Math.PI / 3, curve = 0) {
  const dx = target.x - x;
  const dy = target.y - y;
  const baseAngle = Math.atan2(dy, dx);
  const start = baseAngle - spreadRad / 2;
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? baseAngle : start + (spreadRad * i) / (count - 1);
    const offsetFromCenter = count === 1 ? 0 : i - (count - 1) / 2;
    fireEnemyBullet(projectiles, x, y, Math.cos(a) * speed, Math.sin(a) * speed, null, curve * offsetFromCenter);
  }
}

// Spirale : angle qui tourne d'un pas fixe à chaque appel — l'appelant doit
// conserver et incrémenter `state.angle` lui-même entre deux appels.
export function patternSpiralStep(projectiles, x, y, angle, speed, arms = 3) {
  for (let i = 0; i < arms; i++) {
    const a = angle + (Math.PI * 2 * i) / arms;
    fireEnemyBullet(
      projectiles,
      x,
      y,
      Math.cos(a) * speed,
      Math.sin(a) * speed,
      i === 0 ? PALETTE.bulletEnemy2 : null
    );
  }
}

// curve (rad/s, optionnel) : tout l'anneau tourne lentement en s'étendant —
// effet "pinwheel" plutôt qu'un anneau figé qui grandit en ligne droite.
export function patternRing(projectiles, x, y, speed, count = 12, curve = 0) {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    fireEnemyBullet(projectiles, x, y, Math.cos(a) * speed, Math.sin(a) * speed, null, curve);
  }
}
