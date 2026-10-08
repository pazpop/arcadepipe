// Vaisseau joueur : suivi de la cible d'entrée, tir automatique,
// invincibilité clignotante après un coup.
import { RES_W, RES_H, PLAYER, PALETTE, POWERUP } from "./config.js";
import { buildSprites, drawWithGlow } from "./assets.js";
import { firePlayerBullet, firePlayerPellets } from "./projectiles.js";

export function createPlayer() {
  const player = {};
  resetPlayer(player);
  return player;
}

export function resetPlayer(player) {
  player.x = PLAYER.restX;
  player.y = RES_H / 2;
  player.fireTimer = 0;
  player.invuln = PLAYER.invulnDuration * 0.5;
  player.lives = PLAYER.startingLives;
  player.alive = true;
  player.buff = null; // { type: "power" | "rapid" | "shotgun", timer } — voir POWERUP dans config.js
  player.shield = 0; // coups restants absorbés par le bouclier (indépendant de `buff`, pas de minuteur)
}

// Un bonus de ce type peut-il apparaître ? Pas d'arme tant qu'une arme bonus
// est active, pas de bouclier tant qu'il en reste un. Une arme et un bouclier
// peuvent être actifs ensemble.
export function canReceivePowerup(player, type) {
  return type === "shield" ? player.shield === 0 : player.buff === null;
}

export function applyPowerup(player, type) {
  player.buff = { type, timer: POWERUP.duration };
}

export function applyShield(player, hits) {
  player.shield = hits;
}

export function updatePlayer(player, input, projectiles, dt, onShotFired, canFire) {
  // Suivi progressif de la cible (pas un snap brutal) — lisible même à haute fréquence de mouvement.
  const dx = input.x - player.x;
  const dy = input.y - player.y;
  const maxStep = PLAYER.speed * dt;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxStep) {
    player.x = input.x;
    player.y = input.y;
  } else {
    player.x += (dx / dist) * maxStep;
    player.y += (dy / dist) * maxStep;
  }
  player.x = Math.max(6, Math.min(RES_W - 6, player.x));
  player.y = Math.max(6, Math.min(RES_H - 6, player.y));

  if (player.buff) {
    // Gelé pendant le saut spatial (canFire=false, voir plus bas) : sinon la
    // durée du bonus s'écoule pendant une phase où on ne peut de toute façon
    // pas tirer pour en profiter.
    if (canFire) player.buff.timer -= dt;
    if (player.buff.timer <= 0) player.buff = null;
  }
  const buffDef = player.buff ? POWERUP.types[player.buff.type] : null;

  // Tir manuel : clic/doigt maintenu (input.fireHeld), ou tir automatique
  // (input.autoFire, case à cocher du panneau). Cadence plafonnée par fireCooldown,
  // modulée par le bonus actif. canFire=false : pas de tir pendant un saut
  // spatial ou le niveau bonus (g.clearingScreen, states/waves.js).
  if (canFire) {
    player.fireTimer -= dt;
    if (player.alive && (input.fireHeld || input.autoFire) && player.fireTimer <= 0) {
      const damage = buffDef ? buffDef.damage : 1;
      const color = buffDef ? buffDef.color : null;
      if (player.buff && player.buff.type === "shotgun") {
        firePlayerPellets(projectiles, player.x + 8, player.y, PLAYER.bulletSpeed, damage, color);
      } else {
        firePlayerBullet(projectiles, player.x + 8, player.y, PLAYER.bulletSpeed, damage, color);
      }
      player.fireTimer = PLAYER.fireCooldown * (buffDef ? buffDef.fireCooldownMul : 1);
      onShotFired(player.buff ? player.buff.type : "normal");
    }
  }
}

// false = invulnérabilité en cours (aucun effet), "shield" = absorbé sans perte de vie, true = vie perdue.
export function hitPlayer(player) {
  if (player.invuln > 0) return false;
  if (player.shield > 0) {
    player.shield -= 1;
    // Courte invulnérabilité même sur un coup absorbé — sinon plusieurs tirs
    // dans la même frame vident le bouclier d'un coup.
    player.invuln = PLAYER.shieldHitInvuln;
    return "shield";
  }
  player.invuln = PLAYER.invulnDuration;
  player.lives -= 1;
  if (player.lives <= 0) player.alive = false;
  return true;
}

export function drawPlayer(ctx, player) {
  if (!player.alive) return; // a explosé — ne clignote plus, disparaît (voir la séquence de mort dans states/playing.js)
  if (player.invuln > 0 && Math.floor(player.invuln * 14) % 2 === 0) return; // clignote
  const sprites = buildSprites();
  if (player.shield > 0) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = PALETTE.shield;
    ctx.shadowColor = PALETTE.shield;
    ctx.shadowBlur = 5;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawWithGlow(ctx, sprites.player, player.x, player.y);
}
