// Vagues d'ennemis : types, comportements, tirs. Un pool fixe (comme les
// projectiles/particules) plutôt qu'un tableau qu'on repousse chaque frame.
import { RES_W, RES_H, PALETTE, bulletSpeedFactor } from "./config.js";
import { acquireSlot } from "./pool.js";
import { buildSprites, drawWithGlow } from "./assets.js";
import { patternAimed } from "./patterns.js";
import { spawnExplosion, spawnSpark, spawnFlashBurst } from "./particles.js";

const POOL_SIZE = 40;

// Les ennemis n'APPARAISSENT que dans le tiers droit de l'écran (voir
// spawnEnemyWave) — laisse les 2/3 gauches dégagés à l'apparition, plus
// lisible sur petit écran (mobile). Une fois apparus, ils suivent leur
// trajectoire librement sur tout l'écran comme avant ; seule la sortie
// d'écran (peu importe le bord) les fait disparaître, jamais de rebond.
const LEFT_BOUND = (RES_W * 2) / 3;

const TYPE_STATS = {
  normal: { hp: 1, radius: 4.5, points: 100, speed: 55, fireChance: 0 },
  elite: { hp: 3, radius: 5, points: 300, speed: 45, fireChance: 1 }, // tire toujours (aimed périodique)
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
  return en;
}

// À partir de la vague 5, une partie des ennemis normaux devient "gunner" et
// tire aussi (aimed, plus lent et moins fréquent qu'une élite) — sinon les
// vagues avancées restent identiques niveau menace hors élites/boss.
const GUNNER_MIN_WAVE = 5;
const GUNNER_CHANCE = 0.22;

// Pas de vraie physique de collision entre ennemis (inutile ici) — juste un
// espacement à la génération pour éviter qu'ils apparaissent superposés,
// plus probable maintenant qu'ils apparaissent tous dans le même tiers
// d'écran (une fois en vol, ils s'écartent naturellement).
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
  const type = isElite ? "elite" : "normal";
  const isGunner = !isElite && waveNumber >= GUNNER_MIN_WAVE && Math.random() < GUNNER_CHANCE;
  const stats = TYPE_STATS[type];
  const fromEdge = Math.random() < 0.28 ? (Math.random() < 0.5 ? "top" : "bottom") : "right";

  let x, y, vx, vy;
  // Quelques tentatives pour retomber sur une position pas déjà occupée —
  // au-delà, on accepte le risque plutôt que de bloquer un spawn.
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

// Vitesse de base (avant multiplication par le warp du saut spatial, voir
// setEnemiesLeaving) à laquelle les ennemis en fuite défilent vers la
// gauche — assez rapide pour avoir quitté l'écran bien avant la fin du
// saut spatial (warp qui monte jusqu'à x10, voir updatePlayingMode dans
// game.js), quelle que soit leur position au moment où la vague se termine.
const LEAVE_SPEED = 90;

// Fin de vague : les ennemis encore actifs défilent vers la gauche comme le
// fond étoilé au lieu de disparaître d'un coup (voir aussi le warp appliqué
// dans updateEnemies ci-dessous) — bien plus naturel qu'une disparition
// instantanée, et la vague suivante démarre sans plus aucun ennemi visible
// une fois le saut spatial terminé (voir aussi le filet de sécurité dans
// startWave côté game.js).
export function setEnemiesLeaving(pool) {
  for (const en of pool.items) {
    if (!en.active) continue;
    en.leaving = true;
    en.vx = -LEAVE_SPEED;
    en.vy = 0;
  }
}

export function updateEnemies(pool, dt, projectiles, target, wave, warp = 1) {
  const bulletSpeed = 70 * bulletSpeedFactor(wave);
  for (const en of pool.items) {
    if (!en.active) continue;
    en.elapsed += dt;
    // En fuite (fin de vague) : suit le même rythme que le fond étoilé
    // (multiplié par le warp du saut spatial), sinon vitesse normale.
    en.x += en.vx * dt * (en.leaving ? warp : 1);
    en.y += en.vy * dt;
    // Ondulation latérale pour l'élite — trajectoire moins prévisible.
    // Coupée en fuite : une retraite doit être nette, pas hésitante.
    if (en.type === "elite" && !en.leaving) {
      en.y += Math.sin(en.elapsed * 3 + en.wobbleSeed) * 14 * dt;
    }
    // Sortie d'écran (n'importe quel bord) -> disparaît, jamais de rebond.
    // Le confinement ne s'applique qu'à l'apparition (spawnEnemyWave) ; une
    // fois en vol, la trajectoire traverse librement tout l'écran.
    if (en.x < -20 || en.x > RES_W + 20 || en.y < -30 || en.y > RES_H + 30) {
      en.active = false;
      en.leaving = false;
      continue;
    }
    // En fuite : ne tire plus (on quitte le combat, pas de dernier tir
    // vache) — voir setEnemiesLeaving.
    if ((en.type === "elite" || en.gunner) && !en.leaving) {
      en.fireTimer -= dt;
      if (en.fireTimer <= 0) {
        const speed = en.gunner ? bulletSpeed * 0.75 : bulletSpeed;
        patternAimed(projectiles, en.x, en.y, target, speed, en.gunner ? PALETTE.bulletEnemy2 : null);
        en.fireTimer = en.gunner ? 2.2 + Math.random() * 1.2 : 1.4 + Math.random() * 0.8;
      }
    }
  }
}

export function damageEnemy(en, particlePool, amount = 1) {
  en.hp -= amount;
  if (en.hp <= 0) {
    en.active = false;
    spawnExplosion(particlePool, en.x, en.y, en.type === "elite" ? 24 : 14, PALETTE[`enemy${en.type === "elite" ? "Elite" : "Normal"}`]);
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
    const sprite = en.type === "elite" ? sprites.enemyElite : sprites.enemyNormal;
    const glow = en.type === "elite" ? PALETTE.enemyElite : PALETTE.enemyNormal;
    drawWithGlow(ctx, sprite, en.x, en.y, glow, 0.3);
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
