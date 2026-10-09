// Patterns de tirs ennemis réutilisables : tir visé, éventail, spirale, anneau.
// Chacun peuple lui-même le pool de tirs ennemis (projectiles.enemy).
import { fireEnemyBullet } from "./projectiles.js";
import { PALETTE } from "./config.js";

export function patternAimed(projectiles, x, y, target, speed) {
  const dx = target.x - x;
  const dy = target.y - y;
  const dist = Math.hypot(dx, dy) || 1;
  fireEnemyBullet(projectiles, x, y, (dx / dist) * speed, (dy / dist) * speed);
}

// Éventail de `count` tirs (2 au moins) visant la cible, en couleur "directe".
// curve (rad/s) : les tirs s'incurvent vers l'extérieur, de plus en plus en
// s'éloignant du centre (qui reste droit) — effet "fleur qui s'ouvre".
export function patternFan(projectiles, x, y, target, speed, count, spreadRad, curve) {
  const baseAngle = Math.atan2(target.y - y, target.x - x);
  for (let i = 0; i < count; i++) {
    const side = (2 * i) / (count - 1) - 1; // de -1 (un bord de l'éventail) à 1 (l'autre)
    const a = baseAngle + (spreadRad / 2) * side;
    fireEnemyBullet(projectiles, x, y, Math.cos(a) * speed, Math.sin(a) * speed, PALETTE.bulletBossDirect, curve * side);
  }
}

// Spirale : l'angle tourne d'un pas fixe à chaque appel — l'appelant incrémente
// `angle` lui-même (boss.spiralAngle). Couleur "circulaire" sur tous les bras.
export function patternSpiralStep(projectiles, x, y, angle, speed, arms) {
  for (let i = 0; i < arms; i++) {
    const a = angle + (Math.PI * 2 * i) / arms;
    fireEnemyBullet(projectiles, x, y, Math.cos(a) * speed, Math.sin(a) * speed, PALETTE.bulletBossCircular);
  }
}

// Anneau de `count` tirs partant de `angle` : l'appelant le change à chaque
// salve, sinon les tirs suivraient toujours les mêmes rayons et les couloirs
// entre eux seraient sûrs pour toujours. curve (rad/s) : l'anneau tourne en
// s'étendant — effet "pinwheel". Couleur "circulaire", comme patternSpiralStep.
export function patternRing(projectiles, x, y, angle, speed, count, curve) {
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.PI * 2 * i) / count;
    fireEnemyBullet(projectiles, x, y, Math.cos(a) * speed, Math.sin(a) * speed, PALETTE.bulletBossCircular, curve);
  }
}
