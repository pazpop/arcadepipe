// Niveau bonus : traverser une série d'anneaux plutôt que combattre. Offert
// une fois par cycle (voir g.bonusLevelLastWave dans game.js) si le score
// atteint le seuil du cycle en cours avant BONUS_LEVEL.everyNWaves.
import { RES_W, RES_H, PALETTE, BONUS_LEVEL } from "./config.js";
import { spawnFlashBurst } from "./particles.js";
import { createTwinkleStars, drawTwinkleStars } from "./stars.js";

// Étoiles lointaines qui scintillent, propres au niveau bonus — distinctes
// du champ d'étoiles qui défile normalement (stars.js), pour renforcer
// l'impression de profondeur pendant la traversée des anneaux. Même
// principe que le menu principal (states/menu.js), en plus nombreux/visible.
const TWINKLE_STAR_COUNT = 18;

export function createBonusLevel() {
  return {
    rings: [],
    spawnedCount: 0,
    resolvedCount: 0,
    passedCount: 0,
    // Aucun anneau avant la fin de l'intro (glissée du vaisseau + message
    // explicatif, voir updateBonusLevelShip/drawBonusLevelIntro) — le temps
    // de comprendre ce qui se passe avant que ça commence pour de vrai.
    spawnTimer: BONUS_LEVEL.introDuration,
    introTimer: BONUS_LEVEL.introDuration,
    finished: false,
    elapsed: 0,
    // Positions/phases figées pour toute la durée du niveau (pas recréées à
    // chaque frame) — seule leur luminosité varie (voir drawTwinkleStars).
    twinkleStars: createTwinkleStars(TWINKLE_STAR_COUNT),
  };
}

function spawnRing(bl) {
  const i = bl.spawnedCount;
  const innerRadius = Math.max(BONUS_LEVEL.ringInnerRadiusMin, BONUS_LEVEL.ringInnerRadius - i * BONUS_LEVEL.ringTighten);
  bl.rings.push({
    x: RES_W + BONUS_LEVEL.ringOuterRadius + 10,
    y: 30 + Math.random() * (RES_H - 60),
    innerRadius,
    outerRadius: BONUS_LEVEL.ringOuterRadius,
    resolved: false,
    passed: false,
  });
  bl.spawnedCount += 1;
}

// Fraction d'anneaux réussis sur le total — c'est elle qui détermine combien
// la jauge NOVA se remplit (voir applyNovaReward dans states/playing.js).
export function bonusLevelRewardFraction(bl) {
  if (!bl || BONUS_LEVEL.ringCount <= 0) return 0;
  return bl.passedCount / BONUS_LEVEL.ringCount;
}

export function updateBonusLevel(bl, dt, player, particles, audio) {
  if (bl.finished) return;

  bl.elapsed += dt;
  if (bl.introTimer > 0) bl.introTimer -= dt;

  bl.spawnTimer -= dt;
  if (bl.spawnTimer <= 0 && bl.spawnedCount < BONUS_LEVEL.ringCount) {
    spawnRing(bl);
    bl.spawnTimer = BONUS_LEVEL.ringSpawnInterval;
  }

  for (const ring of bl.rings) {
    // Continue de défiler même une fois résolu (sinon il resterait figé pile
    // à la position du vaisseau au lieu de s'éloigner vers l'arrière) — seule
    // l'évaluation passé/raté ci-dessous ne se fait qu'une fois.
    ring.x -= BONUS_LEVEL.ringSpeed * dt;
    if (ring.resolved) continue;
    // Résolu au croisement du plan du vaisseau (verrouillé en x pendant le
    // niveau bonus, voir updateBonusLevelShip dans states/playing.js) plutôt qu'une
    // vraie détection de collision : plus lisible pour le joueur (le moment
    // où "ça compte" est net, pas une zone floue).
    if (ring.x <= player.x) {
      ring.resolved = true;
      bl.resolvedCount += 1;
      if (Math.abs(player.y - ring.y) <= ring.innerRadius) {
        ring.passed = true;
        bl.passedCount += 1;
        spawnFlashBurst(particles, player.x, player.y, 10);
        audio.playRingPass(bl.passedCount);
      } else {
        audio.playRingMiss();
      }
    }
  }

  if (bl.spawnedCount >= BONUS_LEVEL.ringCount && bl.resolvedCount >= BONUS_LEVEL.ringCount) {
    bl.finished = true;
  }
}

function drawRing(ctx, ring) {
  const color = ring.resolved ? (ring.passed ? PALETTE.gold : PALETTE.danger) : PALETTE.player;
  ctx.save();
  ctx.globalAlpha = ring.resolved ? 0.4 : 0.9;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.lineWidth = ring.outerRadius - ring.innerRadius;
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, (ring.outerRadius + ring.innerRadius) / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawBonusLevel(ctx, bl) {
  drawTwinkleStars(ctx, bl.twinkleStars, bl.elapsed);
  for (const ring of bl.rings) {
    if (ring.x < -ring.outerRadius * 2) continue; // déjà loin derrière, rien à dessiner
    drawRing(ctx, ring);
  }
}
