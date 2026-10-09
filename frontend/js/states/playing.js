// État "playing" : la partie elle-même (mouvement, tirs, ennemis, collisions,
// vagues, boss, niveau bonus, NOVA). drawScene() sert aussi à la pause et à
// GAME OVER, qui affichent la scène figée derrière leur écran (voir game.js).
import { RES_H, PALETTE, DIFFICULTY, PLAYER, POWERUP, BONUS_LEVEL, STORAGE_KEYS, DISTANCE, HIT_STOP, BOSS } from "../config.js";
import { loadItem, saveItem } from "../storage.js";
import { updateStarfield, triggerBossBackdropLeave } from "../stars.js";
import { resetPlayer, updatePlayer, moveToward, hitPlayer, drawPlayer, applyPowerup, applyShield, canReceivePowerup } from "../player.js";
import { updateProjectiles, drawProjectiles } from "../projectiles.js";
import { updateParticles, drawParticles, spawnExplosion, spawnFlashBurst, spawnSpark } from "../particles.js";
import { spawnEnemy, updateEnemies, damageEnemy, pointsFor, drawEnemies, enemyGlowColor } from "../enemies.js";
import { updateBoss, hitBossWeakPoint, hitsBossHull, drawBoss } from "../boss.js";
import { spawnPowerup, updatePowerups, drawPowerups } from "../powerups.js";
import { updateGraze } from "../graze.js";
import { drawBonusLevel } from "../bonusLevel.js";
import { circlesOverlap } from "../collisions.js";
import { deactivateAll } from "../pool.js";
import { consumeJustPressed } from "../input.js";
import * as hud from "../hud.js";
import { MODE } from "./mode.js";
import * as helpState from "./help.js";
import { startWave, updateWaveTransition } from "./waves.js";
import * as endOfRunState from "./endOfRun.js";
import { t } from "../i18n.js";

// Accessibilité : ni tremblement d'écran ni micro-gel pour les joueurs sensibles au mouvement (réglage système).
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Vibration mobile : no-op silencieux si indisponible ou refusée.
function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignoré */
  }
}

// Entrée en douceur du vaisseau (startRun/updateShipIntro) : glisse depuis la
// gauche, premiers ennemis retardés d'autant (g.spawnTimer).
const SHIP_INTRO_DURATION = 1.8;

function triggerShake(g, amount) {
  g.shake = Math.max(g.shake, REDUCED_MOTION ? 0 : amount);
}

function triggerHitStop(g, amount) {
  g.hitStop = Math.max(g.hitStop, REDUCED_MOTION ? 0 : amount);
}

// Tire un type de bonus selon POWERUP.typeWeights.
function pickPowerupType() {
  const weights = POWERUP.typeWeights;
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (const [type, weight] of Object.entries(weights)) {
    r -= weight;
    if (r <= 0) return type;
  }
  return "power"; // filet de sécurité (erreurs d'arrondi flottant)
}

// Couleur de fond de la zone en cours : elle change à chaque boss vaincu.
export function zonePalette(g) {
  return PALETTE.bgZones[Math.floor((g.wave - 1) / DIFFICULTY.bossWaveEvery) % PALETTE.bgZones.length];
}

export function pause(g) {
  g.mode = MODE.PAUSED;
  g.pauseSelected = 0;
  g.pauseStage = "menu";
}

export function startRun(g, engine) {
  const { music, player, projectiles, enemies, particles, powerups } = engine;
  music.playRandom();
  resetPlayer(player);
  for (const pool of [projectiles.player, projectiles.enemy, projectiles.pellet, enemies, particles, powerups]) {
    deactivateAll(pool);
  }
  g.score = 0;
  g.enemiesKilled = 0;
  g.maxGrazeChain = 0;
  g.distanceTraveled = 0;
  g.shake = 0;
  g.flash = 0;
  g.hitStop = 0;
  g.dying = false;
  g.deathTimer = 0;
  g.warp = 1;
  g.novaStock = 0; // vide au début d'une partie — la première charge doit être gagnée (voir graze.js)
  g.novaProgress = 0;
  g.bonusLevel = null;
  g.mode = MODE.PLAYING;
  g.controlHint = engine.input.autoFire ? 0 : 4; // rappel "maintiens pour tirer", inutile en tir automatique
  startWave(g, engine, 1);

  // Entrée en douceur (vague 1 uniquement) — voir SHIP_INTRO_DURATION.
  g.shipIntro = true;
  g.shipIntroTimer = SHIP_INTRO_DURATION;
  player.x = PLAYER.entryX;
  player.y = RES_H / 2;
  g.spawnTimer = SHIP_INTRO_DURATION;

  // Aide de bienvenue : une seule fois par navigateur (ensuite, bouton "Aide").
  if (loadItem(STORAGE_KEYS.seenIntro) !== "1") {
    saveItem(STORAGE_KEYS.seenIntro, "1");
    helpState.open(g, MODE.PLAYING);
  }
}

// --- Collisions internes à l'état "playing" ---

function resolveCollisions(g, engine) {
  const { audio, player, projectiles, particles, enemies, powerups, starfield } = engine;
  // Rien pendant un saut spatial ou le niveau bonus, ni une fois le vaisseau
  // détruit (ralenti de mort) : la partie est jouée.
  if (g.clearingScreen || !player.alive) return;

  // Balles alliées (tirs normaux + plombs CHEVROTINE) vs ennemis normaux/élites
  for (const pool of [projectiles.player, projectiles.pellet]) {
    for (const b of pool.items) {
      if (!b.active) continue;
      for (const en of enemies.items) {
        if (!en.active) continue;
        if (!circlesOverlap(b.x, b.y, pool.radius, en.x, en.y, en.radius)) continue;
        b.active = false;
        const destroyed = damageEnemy(en, particles, b.damage);
        if (destroyed) {
          countKill(g, en);
          audio.playExplosion();
          // Ni shake ni micro-gel sur un kill "classique" (réservés aux
          // élites, coups encaissés et boss), sinon l'effet se banalise.
          if (en.type === "elite") triggerHitStop(g, HIT_STOP.elite);
          // Un seul bonus au sol à la fois, et jamais un bonus dont le joueur
          // profite déjà (canReceivePowerup).
          const dropChance = en.type === "elite" ? POWERUP.dropChanceElite : POWERUP.dropChanceNormal;
          const noneOnScreen = !powerups.items.some((pu) => pu.active);
          if (noneOnScreen && Math.random() < dropChance) {
            const type = pickPowerupType();
            if (canReceivePowerup(player, type)) spawnPowerup(powerups, en.x, en.y, type);
          }
        } else {
          audio.playBossHit();
        }
        break;
      }
    }
  }

  // Balles alliées (tirs normaux + plombs) vs points faibles du boss
  if (g.boss && !g.boss.victory) {
    for (const pool of [projectiles.player, projectiles.pellet]) {
      for (const b of pool.items) {
        if (!b.active) continue;
        const res = hitBossWeakPoint(g.boss, b.x, b.y, pool.radius, particles, b.damage);
        if (res) {
          b.active = false;
          if (res === true) {
            g.score += BOSS.weakPointScore;
            triggerShake(g, 6);
            triggerHitStop(g, HIT_STOP.weakPoint);
            audio.playExplosion();
            if (g.boss.victory) {
              g.score += BOSS.victoryScore;
              player.lives = Math.min(PLAYER.maxLives, player.lives + 1); // récompense de victoire, plafonnée
              g.flash = Math.max(g.flash, 0.6);
              triggerShake(g, 14);
              triggerHitStop(g, HIT_STOP.bossVictory);
              vibrate([40, 60, 40]);
              spawnExplosion(particles, g.boss.x, g.boss.y, 80, PALETTE.boss);
              spawnFlashBurst(particles, g.boss.x, g.boss.y, 24);
              triggerBossBackdropLeave(starfield);
            }
          } else {
            audio.playBossHit();
          }
        }
      }
    }
  }

  // Tirs ennemis vs joueur
  for (const eb of projectiles.enemy.items) {
    if (!eb.active) continue;
    if (circlesOverlap(eb.x, eb.y, projectiles.enemy.radius, player.x, player.y, PLAYER.hitboxRadius)) {
      eb.active = false;
      applyHitToPlayer(g, engine);
    }
  }

  // Corps des ennemis vs joueur : foncer dans un ennemi le détruit, au prix
  // d'un coup (un point de bouclier, ou une vie sans bouclier).
  for (const en of enemies.items) {
    if (!en.active) continue;
    if (circlesOverlap(en.x, en.y, en.radius, player.x, player.y, PLAYER.hitboxRadius)) {
      en.active = false;
      spawnExplosion(particles, en.x, en.y, 8, enemyGlowColor(en));
      applyHitToPlayer(g, engine);
    }
  }

  // Coque du boss vs joueur : foncer dedans fait mal, même si seuls les
  // points faibles tirés endommagent le boss (hitsBossHull ne touche
  // jamais ses PV). Rien pendant le fondu de victoire.
  if (g.boss && !g.boss.victory && hitsBossHull(g.boss, player.x, player.y, PLAYER.hitboxRadius)) {
    applyHitToPlayer(g, engine);
  }

  // Ramassage des bonus
  for (const pu of powerups.items) {
    if (!pu.active) continue;
    // +3 : marge généreuse, ramasser un bonus doit être plus tolérant qu'encaisser un tir.
    if (circlesOverlap(pu.x, pu.y, POWERUP.radius, player.x, player.y, PLAYER.hitboxRadius + 3)) {
      pu.active = false;
      audio.playPowerup();
      spawnFlashBurst(particles, pu.x, pu.y, 8);
      if (pu.type === "shield") {
        applyShield(player, POWERUP.shieldHits);
      } else {
        applyPowerup(player, pu.type);
      }
    }
  }
}

// Un ennemi abattu : points, compteur de la vague et total de la partie.
function countKill(g, en) {
  g.score += pointsFor(en);
  g.waveKills += 1;
  g.enemiesKilled += 1;
}

// NOVA (Espace ou bouton tactile) : dépense une charge et détruit les ennemis
// actifs et leurs tirs en vol, jamais le boss.
function useNova(g, engine) {
  if (g.novaStock <= 0) return;
  g.novaStock -= 1;
  const { audio, particles, enemies, projectiles } = engine;
  for (const en of enemies.items) {
    if (!en.active) continue;
    en.active = false;
    spawnExplosion(particles, en.x, en.y, en.type === "elite" ? 20 : 12, enemyGlowColor(en));
    countKill(g, en);
  }
  for (const eb of projectiles.enemy.items) {
    if (!eb.active) continue;
    eb.active = false;
    spawnSpark(particles, eb.x, eb.y, 3);
  }
  audio.playNovaBlast();
  g.flash = Math.max(g.flash, 0.7);
  triggerShake(g, 12);
  g.banner = { text: t("banner.nova"), timer: 1.2 };
}

// Coup absorbé par le bouclier : pas de vie perdue, réaction plus légère qu'un vrai impact.
function onShieldHit(g, engine) {
  triggerShake(g, 4);
  engine.audio.playBossHit();
  spawnExplosion(engine.particles, engine.player.x, engine.player.y, 10, PALETTE.shield);
}

function onPlayerHit(g, engine) {
  const { audio, particles, player } = engine;
  if (!g.tookDamageThisWave) g.intactBlink = 1; // le rappel "INTACT" du HUD clignote 1 s avant de disparaître
  g.tookDamageThisWave = true; // casse l'éligibilité au bonus DIFFICULTY.noDamageWaveBonus — un coup absorbé par le bouclier (onShieldHit) ne compte pas, lui
  triggerShake(g, 10);
  triggerHitStop(g, HIT_STOP.playerHit);
  vibrate(40);
  audio.playExplosion();
  spawnExplosion(particles, player.x, player.y, 18, PALETTE.player);
  spawnFlashBurst(particles, player.x, player.y, 8);
  if (!player.alive && !g.dying) {
    // Séquence cinématique avant "GAME OVER" : ralenti (voir update ci-dessous)
    // plutôt qu'une coupure directe.
    g.dying = true;
    g.deathTimer = PLAYER.invulnDuration + 0.2;
    triggerShake(g, 16);
  }
}

// Un coup reçu par le joueur, d'où qu'il vienne : absorbé par le bouclier, ou une vie perdue.
function applyHitToPlayer(g, engine) {
  const res = hitPlayer(engine.player);
  if (res === "shield") onShieldHit(g, engine);
  else if (res) onPlayerHit(g, engine);
}

// Position en x pendant une glissée d'entrée : interpolation directe sur
// une durée fixe (pas un suivi par vitesse, bien trop rapide pour rester
// visible) — partagée par l'intro de vague 1 et celle du niveau bonus.
// `timer` compte à rebours vers 0 ; ease-out cubique = ralentit en
// approchant la position finale, comme un vrai vaisseau qui freine.
function easeInFromLeft(timer, duration, startX, targetX) {
  const progress = 1 - Math.max(0, timer) / duration;
  const eased = 1 - Math.pow(1 - progress, 3);
  return startX + (targetX - startX) * eased;
}

// Glissée d'entrée (vague 1) : interpole la position directement (pas via
// updatePlayer) pour qu'un mouvement de souris ne la court-circuite pas. À la
// fin, le vaisseau rejoint la souris ou le doigt.
function updateShipIntro(g, engine, dt) {
  g.shipIntroTimer -= dt;
  engine.player.x = easeInFromLeft(g.shipIntroTimer, SHIP_INTRO_DURATION, PLAYER.entryX, PLAYER.restX);
  if (g.shipIntroTimer <= 0) {
    g.shipIntro = false;
  }
}

// Niveau bonus : x verrouillé (rail plutôt que déplacement libre, le
// franchissement d'un anneau se juge au croisement de ce plan fixe — voir
// updateBonusLevel dans bonusLevel.js), y toujours piloté par la souris/le
// doigt comme en jeu normal.
function updateBonusLevelShip(g, engine, dt) {
  const { player, input } = engine;
  const bl = g.bonusLevel;
  if (bl.introTimer > 0) {
    // y immobile pendant la glissée (voir easeInFromLeft ci-dessus).
    player.x = easeInFromLeft(bl.introTimer, BONUS_LEVEL.introDuration, PLAYER.entryX, PLAYER.restX);
    player.y = RES_H / 2;
    return;
  }
  moveToward(player, PLAYER.restX, input.y, dt);
}

export function update(g, engine, dt) {
  const { input, audio, player, projectiles, particles, enemies, powerups, starfield } = engine;

  // Micro-gel d'impact : dt réduit mais pas nul (un "punch" ressenti, pas
  // une vraie pause) — voir triggerHitStop().
  if (g.hitStop > 0) {
    g.hitStop = Math.max(0, g.hitStop - dt);
    dt *= 0.06;
  }

  // Distance parcourue (cosmétique, voir DISTANCE dans config.js) —
  // proportionnelle au warp courant : compte plus vite pendant un saut
  // spatial/le niveau bonus qu'en vol normal, comme le ressent le joueur.
  g.distanceTraveled += DISTANCE.lightYearsPerSecond * g.warp * dt;

  if (g.dying) {
    // Ralenti après la mort — plus long/prononcé que le micro-gel
    // ci-dessus, tout continue de bouger mais au ralenti jusqu'à GAME OVER.
    g.deathTimer -= dt;
    dt *= 0.16;
    if (g.deathTimer <= 0) {
      g.dying = false;
      endOfRunState.open(g);
      return;
    }
  } else {
    // Décomptée ici et pas dans updatePlayer, qui ne tourne ni pendant la
    // glissée d'entrée ni pendant le niveau bonus : le clignotement resterait figé.
    player.invuln = Math.max(0, player.invuln - dt);
    if (g.shipIntro) {
      updateShipIntro(g, engine, dt);
    } else if (g.bonusLevel) {
      updateBonusLevelShip(g, engine, dt);
    } else {
      updatePlayer(
        player,
        input,
        projectiles,
        dt,
        (colorKey) => {
          if (colorKey === "shotgun") audio.playShotgunBlast();
          else audio.playPlayerShot(colorKey);
        },
        !g.clearingScreen
      );
    }

    if (consumeJustPressed(input, "KeyP") || consumeJustPressed(input, "Escape")) {
      pause(g);
      return;
    }
    // "NovaTrigger" : jeton posé par le bouton tactile (main.js), lu comme une
    // touche. Pas pendant un saut spatial ni le niveau bonus : rien à détruire.
    if (!g.clearingScreen && (consumeJustPressed(input, "Space") || consumeJustPressed(input, "NovaTrigger"))) {
      useNova(g, engine);
    }
  }

  // Vagues, saut spatial entre deux vagues, niveau bonus : voir states/waves.js.
  if (!g.dying) updateWaveTransition(g, engine, dt);

  updateStarfield(starfield, dt, g.warp);

  if (g.banner) {
    g.banner.timer -= dt;
    if (g.banner.timer <= 0) g.banner = null;
  }

  g.shake = Math.max(0, g.shake - dt * 40);
  g.flash = Math.max(0, g.flash - dt * 1.5);
  g.controlHint = Math.max(0, g.controlHint - dt);
  g.intactBlink = Math.max(0, g.intactBlink - dt);

  updateProjectiles(projectiles, dt);
  updateParticles(particles, dt);
  updatePowerups(powerups, dt);

  updateEnemies(enemies, dt, projectiles, player, g.wave, g.warp);

  if (g.boss) {
    updateBoss(g.boss, dt, projectiles, player);
  } else if (g.waveBreak <= 0 && !g.bonusLevel) {
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0) {
      spawnEnemy(enemies, g.wave);
      g.spawnTimer = Math.max(0.12, g.spawnInterval + (Math.random() - 0.5) * 0.15);
    }
  }

  resolveCollisions(g, engine);
  // Après resolveCollisions() : un tir qui a touché ce frame est déjà
  // désactivé, donc jamais compté comme un graze en plus d'un vrai coup.
  updateGraze(g, dt, player, projectiles, enemies, particles, audio);
}

// Rendu de la scène de jeu — aussi appelé pour PAUSED/GAME_OVER, qui dessinent
// leur overlay par-dessus (voir game.js, draw()).
//
// INVARIANT (rien ne l'impose dans le code) : rien de ce qui est appelé d'ici
// ne doit lire performance.now()/Date.now(). Tout doit venir de l'état posé par
// update(), qui ne tourne qu'en mode PLAYING ; draw() tourne dans tous les
// modes, donc une animation lisant l'horloge continuerait pendant la pause.
export function drawScene(c2d, g, engine) {
  const { enemies, powerups, particles, projectiles, player } = engine;
  drawEnemies(c2d, enemies);
  if (g.boss) drawBoss(c2d, g.boss);
  if (g.bonusLevel) drawBonusLevel(c2d, g.bonusLevel);
  drawPowerups(c2d, powerups);
  drawParticles(c2d, particles);
  drawProjectiles(c2d, projectiles);
  drawPlayer(c2d, player);
  hud.drawGameHud(c2d, g, player.lives);
  hud.drawNovaGauge(c2d, g.novaStock, g.novaMax, g.novaProgress);
  if (g.boss) hud.drawBossHealthBar(c2d, g.boss);
  hud.drawBuffIndicator(c2d, player.buff);
  hud.drawShieldIndicator(c2d, player.shield);
  hud.drawBanner(c2d, g.banner);
  if (g.bonusLevel && g.bonusLevel.introTimer > 0) hud.drawBonusLevelIntro(c2d, g.bonusLevel.introTimer);
  hud.drawControlHint(c2d, g.controlHint);
  hud.drawFlash(c2d, g.flash);
}
