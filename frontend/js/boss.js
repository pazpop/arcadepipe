// Boss : arme mécanique massive occupant le tiers droit de l'écran, avec
// 4 à 6 points faibles rouges clignotants. Chaque point détruit accélère
// et densifie les patterns de tir restants (phases). Victoire quand tous
// les points faibles sont détruits.
import { RES_W, RES_H, BOSS, DIFFICULTY, PALETTE, bulletSpeedFactor } from "./config.js";
import { buildSprites } from "./assets.js";
import { patternFan, patternSpiralStep, patternRing } from "./patterns.js";
import { spawnExplosion, spawnFlashBurst } from "./particles.js";

// Le boss ne doit jamais empiéter au-delà du tiers droit de l'écran — même
// zone que l'apparition des ennemis normaux (voir LEFT_BOUND dans
// enemies.js), pour rester lisible sur mobile. Une petite marge l'empêche
// de coller pile sur la limite. Avant, il restait collé au bord droit
// (20px de marge à peine) : trop loin pour donner l'impression d'une vraie
// arrivée en jeu.
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

// Le tout premier combat de boss (voir BOSS.firstBoss* dans config.js) —
// générique plutôt qu'un "wave === 4" en dur, pour rester correct si
// DIFFICULTY.bossWaveEvery change un jour.
function isFirstBoss(boss) {
  return boss.wave === DIFFICULTY.bossWaveEvery;
}

export function spawnBoss(waveNumber) {
  const count = Math.min(
    BOSS.weakPointsMax,
    BOSS.weakPointsMin + Math.floor(waveNumber / (BOSS.weakPointsMin * 2))
  );
  const firstBoss = waveNumber === DIFFICULTY.bossWaveEvery;
  const hp = firstBoss ? Math.max(1, Math.round(BOSS.weakPointHp * BOSS.firstBossHpMul)) : BOSS.weakPointHp;
  const hull = buildSprites().bossHull;
  // Variabilité minime d'un combat à l'autre — même sprite, mais jamais
  // rendu exactement pareil (voir drawBoss) : légère différence de taille
  // (les points faibles et la hitbox de la coque en tiennent compte, voir
  // sizeScale ci-dessous et hitsBossHull) et une teinte discrète appliquée
  // par-dessus (mode composite "hue", garde la même luminosité/saturation
  // grise-métal, juste une nuance différente).
  const sizeScale = 0.92 + Math.random() * 0.16;
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({
      // Positions réparties sur la coque, en coordonnées relatives au centre
      // du boss — concentrées dans la portion large (arrière/droite) de la
      // silhouette en coin, jamais sur le nez effilé (trop étroit pour les
      // contenir, voir BOSS_HULL_ROWS dans assets.js).
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
    hueShift: Math.random() * 360,
    fireTimer: 0.6, // délai avant le tout premier tir, une fois arrivé (voir boss.arrived) — raccourci (était 1.5s), l'attente semblait trop longue
    entryDone: false,
    weakPoints: points,
    victory: false,
    victoryTimer: 0,
  };
}

function destroyedCount(boss) {
  return boss.weakPoints.filter((p) => p.destroyed).length;
}

function phaseSpeed(boss) {
  return Math.pow(BOSS.phaseSpeedupFactor, destroyedCount(boss));
}

// Durée du fondu de la coque après la victoire — assez courte pour ne pas
// "flotter" tout le saut spatial, assez longue pour rester visible pendant
// que l'explosion de victoire se joue par-dessus.
const VICTORY_FADE_DURATION = 0.4;

export function updateBoss(boss, dt, projectiles, target, particlePool) {
  if (!boss) return;
  if (boss.victory) {
    boss.victoryTimer += dt;
    return;
  }

  if (!boss.arrived) {
    boss.x += (boss.targetX - boss.x) * Math.min(1, dt * 1.5);
    if (Math.abs(boss.x - boss.targetX) < 1) boss.arrived = true;
    return;
  }

  boss.y += Math.sin(performance.now() / 900) * 6 * dt;
  boss.y = Math.max(RES_H * 0.3, Math.min(RES_H * 0.7, boss.y));

  for (const p of boss.weakPoints) p.blink += dt * 6;

  boss.fireTimer -= dt * phaseSpeed(boss);
  if (boss.fireTimer <= 0) {
    const firstBoss = isFirstBoss(boss);
    const speed = BOSS.bulletSpeed * bulletSpeedFactor(boss.wave) * (firstBoss ? BOSS.firstBossSpeedMul : 1);
    const countMul = firstBoss ? BOSS.firstBossBulletCountMul : 1;
    const alive = destroyedCount(boss);
    if (alive % 3 === 0) {
      // curve modeste : les tirs aux bords de l'éventail s'ouvrent en
      // "fleur" plutôt que de rester rectilignes — le centre reste droit.
      patternFan(projectiles, boss.x - 20, boss.y, target, speed, Math.max(3, Math.round((5 + alive) * countMul)), Math.PI / 2.2, 0.6);
    } else if (alive % 3 === 1) {
      boss.spiralAngle += 0.4;
      patternSpiralStep(projectiles, boss.x - 20, boss.y, boss.spiralAngle, speed * 0.9, 3 + Math.min(3, alive));
    } else {
      // curve modeste : l'anneau tourne légèrement en s'étendant ("pinwheel").
      patternRing(projectiles, boss.x - 20, boss.y, speed * 0.8, Math.max(6, Math.round((10 + alive * 2) * countMul)), 0.5);
    }
    boss.fireTimer = Math.max(0.35, 1.2 - alive * 0.12) * (firstBoss ? BOSS.firstBossFireIntervalMul : 1);
  }
}

// Retourne true si le point faible touché vient d'être détruit (et donc si
// l'appelant doit vérifier la victoire).
export function hitBossWeakPoint(boss, px, py, radius, particlePool, damage = 1) {
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

// Collision joueur <-> coque du boss (foncer dedans doit faire mal), bien
// distincte de hitBossWeakPoint ci-dessus (seuls les points faibles tirés
// endommagent le BOSS lui-même — cette fonction-ci ne touche jamais à ses
// PV, elle sert uniquement à savoir si le JOUEUR doit encaisser un coup).
//
// Demi-hauteur de la coque à un offset horizontal donné (dx, relatif au
// centre du boss, dans le repère NON mis à l'échelle par sizeScale) —
// reproduit la même progression linéaire (pointe étroite à l'avant/gauche,
// large à l'arrière/droite) que la génération de BOSS_HULL_ROWS dans
// assets.js (grille de 30 colonnes, demi-hauteur 1 à la colonne 0, 7.6 à la
// colonne 29, mise à l'échelle x2). Un simple rectangle englobant, correct
// pour l'ancienne silhouette ovale, ferait "toucher" le vide près du nez
// effilé avec la nouvelle forme en coin.
function hullHalfHeightAt(dx) {
  const localX = 14.5 + dx / 2; // repère de la grille (0..29), avant mise à l'échelle x2
  const t = Math.max(0, Math.min(1, localX / 29));
  return 2 * (1 + t * 6.6);
}

export function hitsBossHull(boss, px, py, radius) {
  const hull = buildSprites().bossHull;
  const scale = boss.sizeScale || 1;
  const halfW = (hull.width / 2) * scale;
  const dx = px - boss.x;
  if (dx < -halfW - radius || dx > halfW + radius) return false;
  const dy = py - boss.y;
  // Ramené au repère non mis à l'échelle pour réutiliser hullHalfHeightAt,
  // puis le résultat est remultiplié par scale (voir sizeScale dans spawnBoss).
  return Math.abs(dy) <= hullHalfHeightAt(dx / scale) * scale + radius;
}

function bossHealthFraction(boss) {
  const total = boss.weakPoints.reduce((s, p) => s + p.maxHp, 0);
  const remaining = boss.weakPoints.reduce((s, p) => s + Math.max(0, p.hp), 0);
  return total === 0 ? 0 : remaining / total;
}

// Dessine la coque à sa taille/teinte propres à ce combat (voir sizeScale/
// hueShift dans spawnBoss) — mode composite "hue" : ne change que la
// teinte, garde la luminosité/saturation du sprite dessous (reste
// gris-métal, ne rivalise jamais avec une couleur de gameplay).
function drawHullSprite(ctx, boss, hull, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(boss.x, boss.y);
  ctx.scale(boss.sizeScale || 1, boss.sizeScale || 1);
  ctx.drawImage(hull, -hull.width / 2, -hull.height / 2);
  ctx.globalCompositeOperation = "hue";
  ctx.fillStyle = `hsl(${boss.hueShift}, 60%, 50%)`;
  ctx.fillRect(-hull.width / 2, -hull.height / 2, hull.width, hull.height);
  ctx.restore();
}

export function drawBoss(ctx, boss) {
  if (!boss) return;
  const hull = buildSprites().bossHull;

  if (boss.victory) {
    if (boss.victoryTimer >= VICTORY_FADE_DURATION) return; // coque entièrement dissipée
    drawHullSprite(ctx, boss, hull, Math.max(0, 1 - boss.victoryTimer / VICTORY_FADE_DURATION));
    return;
  }

  ctx.save();
  drawHullSprite(ctx, boss, hull);

  for (const p of boss.weakPoints) {
    const wx = boss.x + p.ox;
    const wy = boss.y + p.oy;
    if (p.destroyed) {
      ctx.fillStyle = PALETTE.bossWeakOff;
      ctx.fillRect(wx - 4, wy - 4, 8, 8);
      continue;
    }
    // Marqueur agrandi + contour sombre pour qu'il se détache nettement de
    // la coque, quelle que soit sa couleur — plus seulement un pulse de
    // couleur qui pouvait se fondre dans le noyau central.
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

  // Barre de vie du boss, en haut de sa zone (suit sizeScale pour rester
  // alignée avec la largeur réellement affichée de la coque).
  const frac = bossHealthFraction(boss);
  const barW = hull.width * boss.sizeScale;
  const barX = boss.x - barW / 2;
  const barY = boss.y - (hull.height * boss.sizeScale) / 2 - 10;
  ctx.fillStyle = "#2a0a10";
  ctx.fillRect(barX, barY, barW, 3);
  ctx.fillStyle = PALETTE.bossWeakOn;
  ctx.fillRect(barX, barY, barW * frac, 3);
  ctx.restore();
}
