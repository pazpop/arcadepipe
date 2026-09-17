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

// curve (rad/s, optionnel) : les tirs aux extrémités s'incurvent vers
// l'extérieur (centre droit) — effet "fleur qui s'ouvre". Couleur "directe"
// par défaut (PALETTE.bulletBossDirect) — seul le boss utilise ce pattern.
export function patternFan(projectiles, x, y, target, speed, count = 5, spreadRad = Math.PI / 3, curve = 0, color = PALETTE.bulletBossDirect) {
  const dx = target.x - x;
  const dy = target.y - y;
  const baseAngle = Math.atan2(dy, dx);
  const start = baseAngle - spreadRad / 2;
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? baseAngle : start + (spreadRad * i) / (count - 1);
    const offsetFromCenter = count === 1 ? 0 : i - (count - 1) / 2;
    fireEnemyBullet(projectiles, x, y, Math.cos(a) * speed, Math.sin(a) * speed, color, curve * offsetFromCenter);
  }
}

// Spirale : angle tourne d'un pas fixe à chaque appel — l'appelant incrémente
// `state.angle` lui-même. Couleur "circulaire" par défaut (tous les bras,
// pas juste le premier — un pattern dense doit rester lisible d'un bloc).
export function patternSpiralStep(projectiles, x, y, angle, speed, arms = 3, color = PALETTE.bulletBossCircular) {
  for (let i = 0; i < arms; i++) {
    const a = angle + (Math.PI * 2 * i) / arms;
    fireEnemyBullet(projectiles, x, y, Math.cos(a) * speed, Math.sin(a) * speed, color);
  }
}

// curve (rad/s, optionnel) : l'anneau tourne en s'étendant — effet
// "pinwheel". Couleur "circulaire" par défaut, comme patternSpiralStep.
export function patternRing(projectiles, x, y, speed, count = 12, curve = 0, color = PALETTE.bulletBossCircular) {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    fireEnemyBullet(projectiles, x, y, Math.cos(a) * speed, Math.sin(a) * speed, color, curve);
  }
}
