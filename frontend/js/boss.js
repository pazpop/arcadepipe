// Boss : arme mécanique massive occupant le tiers droit de l'écran, avec
// 4 à 6 points faibles clignotants (jaunes, puis orange et rouges sous les dégâts). Chaque point détruit accélère
// et densifie les patterns de tir restants (phases). Invulnérable pendant
// son entrée à l'écran. Victoire quand tous les points faibles sont détruits.
import { RES_W, RES_H, BOSS, DIFFICULTY, PALETTE, bulletSpeedFactor } from "./config.js";
import { buildSprites } from "./assets.js";
import { patternFan, patternSpiralStep, patternRing } from "./patterns.js";
import { spawnExplosion, spawnFlashBurst } from "./particles.js";

// Le boss reste dans le tiers droit de l'écran (comme LEFT_BOUND dans
// enemies.js), pour rester lisible sur mobile. Petite marge pour ne pas
// coller pile sur la limite.
const RIGHT_ZONE_BOUND = (RES_W * 2) / 3;
const BOSS_ZONE_MARGIN = 12;

// Couleur d'un point faible selon les dégâts déjà encaissés (fraction de
// p.hp/p.maxHp restante) — dérivée directement des PV, pas d'état à part à
// maintenir. Sain = même couleur pour tous (WEAK_POINT_COLORS[0]), puis
// passe par les suivantes à mesure qu'il approche de sa destruction.
const WEAK_POINT_COLORS = [PALETTE.bossWeakOn, PALETTE.bossWeakHit, PALETTE.bossWeakCritical];
function weakPointColor(p) {
  const dmgFrac = 1 - p.hp / p.maxHp;
  const idx = Math.min(WEAK_POINT_COLORS.length - 1, Math.floor(dmgFrac * WEAK_POINT_COLORS.length));
  return WEAK_POINT_COLORS[idx];
}

// Le tout premier combat de boss, adouci (voir BOSS.firstBoss* dans config.js).
function isFirstBoss(wave) {
  return wave === DIFFICULTY.bossWaveEvery;
}

export function spawnBoss(waveNumber) {
  const count = Math.min(
    BOSS.weakPointsMax,
    BOSS.weakPointsMin + Math.floor(waveNumber / (BOSS.weakPointsMin * 2))
  );
  const firstBoss = isFirstBoss(waveNumber);
  const hp = firstBoss ? Math.max(1, Math.round(BOSS.weakPointHp * BOSS.firstBossHpMul)) : BOSS.weakPointHp;
  const hull = buildSprites().bossHull;
  // Variabilité minime d'un combat à l'autre : taille (sizeScale, pris en
  // compte par hitsBossHull) et teinte (tintedHull, qui garde le gris-métal).
  const sizeScale = 0.92 + Math.random() * 0.16;
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({
      // Positions relatives au centre du boss, concentrées à l'arrière/droite
      // (large) — jamais sur le nez effilé, trop étroit (BOSS_HULL_ROWS dans assets.js).
      ox: (hull.width * 0.05 + (i % 3) * (hull.width * 0.183)) * sizeScale,
      oy: (-hull.height / 2 + 8 + Math.floor(i / 3) * (hull.height - 16)) * sizeScale,
      hp,
      maxHp: hp,
      destroyed: false,
      blink: Math.random() * Math.PI * 2,
    });
  }
  return {
    wave: waveNumber,
    x: RES_W + hull.width / 2,
    y: RES_H / 2,
    targetX: RIGHT_ZONE_BOUND + BOSS_ZONE_MARGIN + hull.width / 2,
    arrived: false,
    spiralAngle: 0,
    sizeScale,
    hull: tintedHull(hull, Math.random() * 360), // coque à la teinte de ce combat
    fireTimer: 0.3, // délai avant le 1er tir, une fois arrivé (boss.arrived)
    elapsed: 0, // secondes depuis l'arrivée, pour le flottement vertical
    weakPoints: points,
    victory: false,
    victoryTimer: 0,
  };
}

function destroyedCount(boss) {
  return boss.weakPoints.filter((p) => p.destroyed).length;
}

// Phase du combat, de 0 à weakPointsMax - 1 : elle monte à chaque point faible
// détruit, et aussi avec le temps (toutes les BOSS.hurryEverySeconds), pour
// qu'un boss qu'on se contente d'esquiver ne reste pas inoffensif.
export function bossPhase(destroyed, elapsed) {
  return Math.min(BOSS.weakPointsMax - 1, destroyed + Math.floor(elapsed / BOSS.hurryEverySeconds));
}

// Secondes entre deux salves : l'intervalle raccourcit à chaque phase.
export function bossFireInterval(phase, firstBoss) {
  const interval = BOSS.fireInterval * Math.pow(BOSS.fireIntervalFactor, phase);
  return firstBoss ? interval * BOSS.firstBossFireIntervalMul : interval;
}

// Nombre de tirs de l'éventail. Toujours impair : le tir du milieu vise le
// joueur, qui ne peut donc pas rester immobile.
export function bossFanCount(destroyed, firstBoss) {
  const countMul = firstBoss ? BOSS.firstBossBulletCountMul : 1;
  const count = Math.max(3, Math.round((5 + destroyed) * countMul));
  return count % 2 === 0 ? count + 1 : count;
}

// Durée du fondu de la coque après la victoire — courte pour ne pas "flotter"
// tout le saut spatial, assez longue pour rester visible pendant l'explosion.
const VICTORY_FADE_DURATION = 0.4;

export function updateBoss(boss, dt, projectiles, target) {
  if (boss.victory) {
    boss.victoryTimer += dt;
    return;
  }

  if (!boss.arrived) {
    // Entrée en ~1,5 s (approche exponentielle).
    boss.x += (boss.targetX - boss.x) * Math.min(1, dt * 3);
    if (Math.abs(boss.x - boss.targetX) < 2) boss.arrived = true;
    return;
  }

  boss.elapsed += dt;
  boss.y = RES_H / 2 + Math.sin(boss.elapsed / 0.9) * 5.4;

  for (const p of boss.weakPoints) p.blink += dt * 6;

  boss.fireTimer -= dt;
  if (boss.fireTimer <= 0) {
    const firstBoss = isFirstBoss(boss.wave);
    const speed = BOSS.bulletSpeed * bulletSpeedFactor(boss.wave) * (firstBoss ? BOSS.firstBossSpeedMul : 1);
    const countMul = firstBoss ? BOSS.firstBossBulletCountMul : 1;
    const destroyed = destroyedCount(boss);
    if (destroyed % 3 === 0) {
      // courbe légère (0,6 rad/s aux bords) : l'éventail s'ouvre en "fleur", le centre reste droit.
      patternFan(projectiles, boss.x - 20, boss.y, target, speed, bossFanCount(destroyed, firstBoss), Math.PI / 2.2, 0.6);
    } else if (destroyed % 3 === 1) {
      boss.spiralAngle += 0.4;
      patternSpiralStep(projectiles, boss.x - 20, boss.y, boss.spiralAngle, speed * 0.9, 3 + Math.min(3, destroyed));
    } else {
      // Chaque salve est décalée d'un demi-écart entre deux tirs : elle passe
      // là où la précédente laissait un couloir. curve modeste : l'anneau
      // tourne légèrement en s'étendant ("pinwheel").
      const count = Math.max(6, Math.round((10 + destroyed * 2) * countMul));
      boss.spiralAngle += Math.PI / count;
      patternRing(projectiles, boss.x - 20, boss.y, boss.spiralAngle, speed * 0.8, count, 0.5);
    }
    boss.fireTimer = bossFireInterval(bossPhase(destroyed, boss.elapsed), firstBoss);
  }
}

// true = point détruit (l'appelant doit vérifier la victoire), "hit" = touché
// mais survit, false = aucun point touché.
export function hitBossWeakPoint(boss, px, py, radius, particlePool, damage) {
  // Invulnérable pendant l'entrée : sinon détruit avant même son premier tir.
  if (!boss.arrived) return false;
  for (const p of boss.weakPoints) {
    if (p.destroyed) continue;
    const wx = boss.x + p.ox;
    const wy = boss.y + p.oy;
    const dx = px - wx;
    const dy = py - wy;
    if (dx * dx + dy * dy > (radius + 4) * (radius + 4)) continue;
    p.hp -= damage;
    if (p.hp <= 0) {
      p.destroyed = true;
      spawnExplosion(particlePool, wx, wy, 26, PALETTE.bossWeakOn);
      spawnFlashBurst(particlePool, wx, wy, 12);
      if (destroyedCount(boss) >= boss.weakPoints.length) boss.victory = true;
      return true;
    }
    spawnExplosion(particlePool, wx, wy, 6, PALETTE.bossWeakOn);
    return "hit";
  }
  return false;
}

// Collision joueur <-> coque (distincte de hitBossWeakPoint : ne touche
// jamais aux PV du boss, sert juste à savoir si le joueur encaisse un coup).
//
// Demi-hauteur de la coque à un offset horizontal dx (repère non mis à
// l'échelle) — reproduit la progression de BOSS_HULL_ROWS dans assets.js
// (étroit à l'avant, large à l'arrière) ; un rectangle englobant toucherait
// le vide près du nez effilé.
function hullHalfHeightAt(dx) {
  const localX = 14.5 + dx / 2; // repère de la grille (0..29), avant mise à l'échelle x2
  const t = Math.max(0, Math.min(1, localX / 29));
  return 2 * (1 + t * 6.6); // demi-hauteur : 1 à la colonne 0, 7.6 à la colonne 29 (grille), ×2 pour l'échelle du sprite
}

export function hitsBossHull(boss, px, py, radius) {
  const hull = buildSprites().bossHull;
  const scale = boss.sizeScale;
  const halfW = (hull.width / 2) * scale;
  const dx = px - boss.x;
  if (dx < -halfW - radius || dx > halfW + radius) return false;
  const dy = py - boss.y;
  // Ramené au repère non mis à l'échelle pour réutiliser hullHalfHeightAt, puis remultiplié par scale.
  return Math.abs(dy) <= hullHalfHeightAt(dx / scale) * scale + radius;
}

export function bossHealthFraction(boss) {
  const total = boss.weakPoints.reduce((s, p) => s + p.maxHp, 0);
  const remaining = boss.weakPoints.reduce((s, p) => s + Math.max(0, p.hp), 0);
  return remaining / total;
}

// Copie de la coque, teintée : le mode "hue" change la teinte en gardant le
// gris-métal du sprite. Faite une fois par boss, hors de l'écran, pour que la
// teinte ne touche que la coque et pas le décor derrière elle.
function tintedHull(hull, hue) {
  const canvas = document.createElement("canvas");
  canvas.width = hull.width;
  canvas.height = hull.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(hull, 0, 0);
  ctx.globalCompositeOperation = "hue";
  ctx.fillStyle = `hsl(${hue}, 60%, 50%)`;
  ctx.fillRect(0, 0, hull.width, hull.height);
  ctx.globalCompositeOperation = "destination-in"; // ne garde que les pixels de la coque
  ctx.drawImage(hull, 0, 0);
  return canvas;
}

// Dessine la coque à la taille de ce combat (sizeScale).
function drawHullSprite(ctx, boss, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(boss.x, boss.y);
  ctx.scale(boss.sizeScale, boss.sizeScale);
  ctx.drawImage(boss.hull, -boss.hull.width / 2, -boss.hull.height / 2);
  ctx.restore();
}

export function drawBoss(ctx, boss) {
  if (boss.victory) {
    if (boss.victoryTimer >= VICTORY_FADE_DURATION) return; // coque entièrement dissipée
    drawHullSprite(ctx, boss, Math.max(0, 1 - boss.victoryTimer / VICTORY_FADE_DURATION));
    return;
  }

  ctx.save();
  drawHullSprite(ctx, boss, 1);

  for (const p of boss.weakPoints) {
    const wx = boss.x + p.ox;
    const wy = boss.y + p.oy;
    if (p.destroyed) {
      ctx.fillStyle = PALETTE.bossWeakOff;
      ctx.fillRect(wx - 4, wy - 4, 8, 8);
      continue;
    }
    // Marqueur agrandi + contour sombre pour se détacher nettement de la coque, quelle que soit sa couleur.
    const blink = 0.5 + 0.5 * Math.sin(p.blink);
    ctx.globalAlpha = 0.35 + blink * 0.65;
    ctx.fillStyle = "#1a0a08";
    ctx.fillRect(wx - 5, wy - 5, 10, 10);
    const color = weakPointColor(p);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillRect(wx - 4, wy - 4, 8, 8);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
