// Vagues d'ennemis : types, comportements, tirs. Un pool fixe (comme les
// projectiles/particules) plutôt qu'un tableau qu'on repousse chaque frame.
import { RES_W, RES_H, PALETTE, bulletSpeedFactor } from "./config.js";
import { acquireSlot } from "./pool.js";
import { buildSprites, drawWithGlow } from "./assets.js";
import { patternAimed } from "./patterns.js";
import { spawnExplosion, spawnSpark, spawnFlashBurst } from "./particles.js";

const POOL_SIZE = 40;

// Ennemis n'APPARAISSENT que dans le tiers droit (spawnEnemyWave) — plus
// lisible sur mobile. Une fois en vol, trajectoire libre sur tout l'écran,
// disparaît en sortant (jamais de rebond).
const LEFT_BOUND = (RES_W * 2) / 3;

const TYPE_STATS = {
  normal: { hp: 1, radius: 4.5, points: 100, speed: 55, fireChance: 0 },
  elite: { hp: 3, radius: 5, points: 300, speed: 45, fireChance: 1 }, // tire toujours (aimed périodique)
  // Ne tire jamais (fireChance 0) — sa menace, c'est sa trajectoire, pas ses
  // tirs (voir la poursuite dans updateEnemies). 1 PV : facile à abattre si
  // on réagit vite, dangereux si on l'ignore.
  kamikaze: { hp: 1, radius: 4, points: 150, speed: 70, fireChance: 0 },
};

export function createEnemyPool() {
  return {
    items: Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      type: "normal",
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      wobbleSeed: 0,
      hp: 1,
      maxHp: 1,
      radius: 4,
      fireTimer: 0,
      elapsed: 0,
      gunner: false,
      leaving: false, // fin de vague : défile vers la gauche au lieu de disparaître (voir setEnemiesLeaving)
      grazeCooldown: 0, // kamikaze uniquement (voir graze.js) — délai avant de pouvoir regrazer au corps
    })),
  };
}

function spawnOne(pool, type, x, y, vx, vy, gunner = false) {
  const stats = TYPE_STATS[type];
  const en = acquireSlot(pool);
  if (!en) return null;
  en.active = true;
  en.type = type;
  en.x = x;
  en.y = y;
  en.vx = vx;
  en.vy = vy;
  en.wobbleSeed = Math.random() * Math.PI * 2;
  en.hp = stats.hp;
  en.maxHp = stats.hp;
  en.radius = stats.radius;
  en.fireTimer = 0.6 + Math.random() * 0.8;
  en.elapsed = 0;
  en.gunner = gunner;
  en.leaving = false;
  en.grazeCooldown = 0;
  return en;
}

// Dès la vague 5, une partie des ennemis normaux devient "gunner" et tire
// aussi (plus lent/moins fréquent qu'une élite).
const GUNNER_MIN_WAVE = 5;
const GUNNER_CHANCE = 0.22;

// Dès la vague 4, une petite chance de tomber sur un kamikaze plutôt qu'un
// ennemi normal — exclusif avec élite/gunner (voir spawnEnemyWave).
const KAMIKAZE_MIN_WAVE = 4;
const KAMIKAZE_CHANCE = 0.12;

// Pas de vraie physique de collision — juste un espacement à la génération
// pour éviter qu'ils apparaissent superposés (tous dans le même tiers d'écran).
const SPAWN_MIN_GAP = 14;

function tooCloseToActive(pool, x, y, minGap) {
  const minGapSq = minGap * minGap;
  for (const en of pool.items) {
    if (!en.active) continue;
    const dx = en.x - x;
    const dy = en.y - y;
    if (dx * dx + dy * dy < minGapSq) return true;
  }
  return false;
}

// Entrée par la droite par défaut, ou par le haut/bas (dans le tiers droit
// de l'écran) pour varier les angles d'approche.
export function spawnEnemyWave(pool, waveNumber, eliteChance) {
  const isElite = waveNumber >= 3 && Math.random() < eliteChance;
  const isKamikaze = !isElite && waveNumber >= KAMIKAZE_MIN_WAVE && Math.random() < KAMIKAZE_CHANCE;
  const type = isElite ? "elite" : isKamikaze ? "kamikaze" : "normal";
  const isGunner = !isElite && !isKamikaze && waveNumber >= GUNNER_MIN_WAVE && Math.random() < GUNNER_CHANCE;
  const stats = TYPE_STATS[type];
  const fromEdge = Math.random() < 0.28 ? (Math.random() < 0.5 ? "top" : "bottom") : "right";

  let x, y, vx, vy;
  // Quelques tentatives pour une position libre — au-delà, on accepte le risque plutôt que de bloquer le spawn.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (fromEdge === "right") {
      x = RES_W + 10;
      y = 20 + Math.random() * (RES_H - 40);
      vx = -stats.speed;
      vy = (Math.random() - 0.5) * 20;
    } else {
      x = LEFT_BOUND + Math.random() * (RES_W / 3 - 10);
      y = fromEdge === "top" ? -10 : RES_H + 10;
      vx = -stats.speed * 0.8;
      vy = (fromEdge === "top" ? 1 : -1) * (stats.speed * 0.6);
    }
    if (!tooCloseToActive(pool, x, y, SPAWN_MIN_GAP)) break;
  }
  return spawnOne(pool, type, x, y, vx, vy, isGunner);
}

// Vitesse de base des ennemis en fuite (avant le warp, x10 max — voir
// updatePlayingMode) : assez rapide pour quitter l'écran bien avant la fin
// du saut spatial.
const LEAVE_SPEED = 90;

// Fin de vague : les ennemis actifs défilent vers la gauche comme le fond
// (plus naturel qu'une disparition instantanée) — voir aussi le filet de
// sécurité dans startWave (game.js).
export function setEnemiesLeaving(pool) {
  for (const en of pool.items) {
    if (!en.active) continue;
    en.leaving = true;
    en.vx = -LEAVE_SPEED;
    en.vy = 0;
  }
}

// Poursuite du kamikaze : re-vise le joueur en continu, mais la rotation est
// plafonnée (rad/s) plutôt qu'un demi-tour instantané — assez insistant pour
// être une vraie menace, assez lent pour rester esquivable en bougeant.
const KAMIKAZE_TURN_RATE = 2.6;

export function updateEnemies(pool, dt, projectiles, target, wave, warp = 1) {
  const bulletSpeed = 70 * bulletSpeedFactor(wave);
  for (const en of pool.items) {
    if (!en.active) continue;
    en.elapsed += dt;
    // Re-vise le joueur avant de bouger, pour que ce soit bien vx/vy déjà à
    // jour qui déterminent le déplacement de cette frame ci-dessous.
    if (en.type === "kamikaze" && !en.leaving) {
      const speed = Math.hypot(en.vx, en.vy);
      const current = Math.atan2(en.vy, en.vx);
      const desired = Math.atan2(target.y - en.y, target.x - en.x);
      const diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
      const turn = Math.max(-KAMIKAZE_TURN_RATE * dt, Math.min(KAMIKAZE_TURN_RATE * dt, diff));
      const angle = current + turn;
      en.vx = Math.cos(angle) * speed;
      en.vy = Math.sin(angle) * speed;
    }
    // En fuite : suit le rythme du fond étoilé (warp), sinon vitesse normale.
    en.x += en.vx * dt * (en.leaving ? warp : 1);
    en.y += en.vy * dt;
    // Ondulation latérale pour l'élite (trajectoire moins prévisible), coupée en fuite.
    if (en.type === "elite" && !en.leaving) {
      en.y += Math.sin(en.elapsed * 3 + en.wobbleSeed) * 14 * dt;
    }
    // Sortie d'écran (tout bord) -> disparaît, jamais de rebond. Le
    // confinement ne s'applique qu'à l'apparition (spawnEnemyWave).
    if (en.x < -20 || en.x > RES_W + 20 || en.y < -30 || en.y > RES_H + 30) {
      en.active = false;
      en.leaving = false;
      continue;
    }
    // En fuite : ne tire plus (pas de dernier tir vache).
    if ((en.type === "elite" || en.gunner) && !en.leaving) {
      en.fireTimer -= dt;
      if (en.fireTimer <= 0) {
        const speed = en.gunner ? bulletSpeed * 0.75 : bulletSpeed;
        // Même couleur (PALETTE.bulletEnemy, défaut de patternAimed) pour
        // élite et gunner — les deux sont un tir visé classique, distinguer
        // leur couleur n'aidait pas à savoir comment l'esquiver.
        patternAimed(projectiles, en.x, en.y, target, speed);
        en.fireTimer = en.gunner ? 2.2 + Math.random() * 1.2 : 1.4 + Math.random() * 0.8;
      }
    }
  }
}

// Couleur du palier de menace (facile/moyen/difficile — voir PALETTE dans
// config.js) — partagée entre le rendu (sprite/glow) et les explosions, pour
// qu'un vaisseau jaune explose en jaune plutôt qu'en vert par défaut.
export function enemyGlowColor(en) {
  if (en.type === "elite") return PALETTE.enemyElite;
  if (en.type === "kamikaze") return PALETTE.danger;
  return en.gunner ? PALETTE.enemyGunner : PALETTE.enemyNormal;
}

export function damageEnemy(en, particlePool, amount = 1) {
  en.hp -= amount;
  const color = enemyGlowColor(en);
  if (en.hp <= 0) {
    en.active = false;
    spawnExplosion(particlePool, en.x, en.y, en.type === "elite" ? 24 : 14, color);
    spawnFlashBurst(particlePool, en.x, en.y, en.type === "elite" ? 10 : 6);
    return true; // détruit
  }
  spawnSpark(particlePool, en.x, en.y, 5);
  return false; // touché mais survit
}

export function pointsFor(en) {
  return TYPE_STATS[en.type].points;
}

export function drawEnemies(ctx, pool) {
  const sprites = buildSprites();
  for (const en of pool.items) {
    if (!en.active) continue;
    const sprite =
      en.type === "elite" ? sprites.enemyElite
      : en.type === "kamikaze" ? sprites.enemyKamikaze
      : en.gunner ? sprites.enemyGunner
      : sprites.enemyNormal;
    const glow = enemyGlowColor(en);
    if (en.type === "kamikaze") {
      // Orienté selon sa vitesse réelle (pas fixe comme les autres) — se voit
      // pivoter à mesure qu'il rectifie sa trajectoire vers le joueur (voir
      // updateEnemies). Le sprite pointe vers +X au repos (ENEMY_KAMIKAZE_ROWS).
      ctx.save();
      ctx.translate(en.x, en.y);
      ctx.rotate(Math.atan2(en.vy, en.vx));
      drawWithGlow(ctx, sprite, 0, 0, glow, 0.3);
      ctx.restore();
    } else {
      drawWithGlow(ctx, sprite, en.x, en.y, glow, 0.3);
    }
    if (en.maxHp > 1) {
      ctx.save();
      ctx.fillStyle = glow;
      for (let i = 0; i < en.hp; i++) {
        ctx.fillRect(en.x - (en.maxHp - 1) * 3 + i * 6 - 1, en.y - sprite.height / 2 - 5, 2, 2);
      }
      ctx.restore();
    }
  }
}
