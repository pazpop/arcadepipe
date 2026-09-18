// État "playing" : boucle de jeu (mouvement, tirs, ennemis, collisions,
// vagues, boss, niveau bonus, NOVA) — le plus gros morceau de la machine à
// états, seul à gérer autant de sous-systèmes à la fois. drawScene() est
// aussi appelée pour PAUSED et GAME_OVER (voir game.js, draw()) : ces deux
// écrans affichent la scène figée derrière leur overlay plutôt qu'un fond
// vide, donc le rendu de la scène elle-même n'est pas propre à "playing" au
// sens strict, mais vit ici avec le reste de l'état qui la nourrit.
import { RES_W, RES_H, PALETTE, DIFFICULTY, PLAYER, POWERUP, BONUS_LEVEL, STORAGE_KEYS } from "../config.js";
import { updateStarfield, spawnDeathStarBackdrop, triggerDeathStarLeave } from "../stars.js";
import { resetPlayer, updatePlayer, hitPlayer, drawPlayer, applyPowerup, applyShield } from "../player.js";
import { updateProjectiles, drawProjectiles } from "../projectiles.js";
import { updateParticles, drawParticles, spawnExplosion, spawnFlashBurst, spawnSpark } from "../particles.js";
import { spawnEnemyWave, updateEnemies, setEnemiesLeaving, damageEnemy, pointsFor, drawEnemies, enemyGlowColor } from "../enemies.js";
import { spawnBoss, updateBoss, hitBossWeakPoint, hitsBossHull, drawBoss } from "../boss.js";
import { spawnPowerup, updatePowerups, drawPowerups } from "../powerups.js";
import { updateGraze, novaMaxForWave } from "../graze.js";
import { createBonusLevel, updateBonusLevel, drawBonusLevel, bonusLevelRewardFraction } from "../bonusLevel.js";
import { circlesOverlap } from "../collisions.js";
import { consumeJustPressed } from "../input.js";
import * as hud from "../hud.js";
import { MODE } from "./mode.js";
import * as helpState from "./help.js";

// Accessibilité : coupe le screen shake pour les joueurs sensibles au mouvement (réglage système).
const REDUCED_MOTION =
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Vibration mobile : no-op silencieux si indisponible ou refusée.
function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignoré */
  }
}

// Aide vue une fois par navigateur (revoir via le bouton "Aide" ensuite).
function hasSeenHint(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function markHintSeen(key) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* stockage indisponible — pas bloquant */
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

// Probabilité qu'un ennemi normal soit une élite à la place — monte avec
// la vague, plafonnée à 25% pour ne jamais dominer le flux d'ennemis normaux.
function eliteChance(g) {
  return Math.min(0.25, 0.06 + g.wave * 0.015);
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

function isBossWave(wave) {
  return wave % DIFFICULTY.bossWaveEvery === 0;
}

// Utilisée aussi par game.js (couleur de fond hors de "playing" à proprement
// parler, ex. pendant PAUSED/GAME_OVER qui affichent la même scène figée).
export function zonePalette(g) {
  return PALETTE.bgZones[Math.floor((g.wave - 1) / DIFFICULTY.bossWaveEvery) % PALETTE.bgZones.length];
}

function startWave(g, engine, wave) {
  g.wave = wave;
  g.waveKills = 0;
  g.tookDamageThisWave = false;
  g.grazeChain = 0;
  g.novaMax = novaMaxForWave(wave);
  g.novaStock = Math.min(g.novaStock, g.novaMax);
  g.waveKillTarget = DIFFICULTY.baseWaveKills + (wave - 1) * DIFFICULTY.waveKillsStep;
  g.spawnInterval = Math.max(
    DIFFICULTY.minSpawnInterval,
    DIFFICULTY.baseSpawnInterval - (wave - 1) * DIFFICULTY.spawnIntervalStep
  );
  g.waveBreak = 0;
  g.boss = null;
  if (isBossWave(wave)) {
    g.banner = { text: `VAGUE ${wave} — ARME MASSIVE EN APPROCHE`, timer: 2.5 };
    g.boss = spawnBoss(wave);
    spawnDeathStarBackdrop(engine.starfield);
  } else {
    g.banner = { text: `VAGUE ${wave}`, timer: 1.8 };
    // Filet de sécurité : évite qu'un décor de boss traîne au début d'une
    // vague normale (chemin normal = triggerDeathStarLeave à la victoire).
    engine.starfield.deathStar = null;
  }
}

export function startRun(g, engine) {
  const { music, player, projectiles, enemies, particles, powerups } = engine;
  music.playRandom();
  resetPlayer(player);
  for (const b of projectiles.player.items) b.active = false;
  for (const b of projectiles.enemy.items) b.active = false;
  for (const b of projectiles.pellet.items) b.active = false;
  for (const e of enemies.items) e.active = false;
  for (const p of particles.items) p.active = false;
  for (const pu of powerups.items) pu.active = false;
  g.score = 0;
  g.enemiesKilled = 0;
  g.maxGrazeChain = 0;
  g.shake = 0;
  g.flash = 0;
  g.hitStop = 0;
  g.dying = false;
  g.deathTimer = 0;
  g.warp = 1;
  g.novaStock = 0; // vide au début d'une partie — la première charge doit être gagnée (voir graze.js)
  g.novaProgress = 0;
  g.bonusLevel = null;
  g.bonusLevelLastWave = 0;
  g.mode = MODE.PLAYING;
  g.controlHint = 4;
  startWave(g, engine, 1);

  // Entrée en douceur (vague 1 uniquement) — voir SHIP_INTRO_DURATION.
  g.shipIntro = true;
  g.shipIntroTimer = SHIP_INTRO_DURATION;
  player.x = -20;
  player.y = RES_H / 2;
  g.spawnTimer = SHIP_INTRO_DURATION;

  if (!hasSeenHint(STORAGE_KEYS.seenIntro)) {
    markHintSeen(STORAGE_KEYS.seenIntro);
    helpState.open(g, MODE.PLAYING);
  }
}

// --- Collisions internes à l'état "playing" ---

function resolveCollisions(g, engine) {
  const { audio, player, projectiles, particles, enemies, powerups, starfield } = engine;
  if (g.clearingScreen) return;

  // Balles alliées (tirs normaux + plombs CHEVROTINE) vs ennemis normaux/élites
  for (const pool of [projectiles.player, projectiles.pellet]) {
    for (const b of pool.items) {
      if (!b.active) continue;
      for (const en of enemies.items) {
        if (!en.active) continue;
        if (!circlesOverlap(b.x, b.y, pool.radius, en.x, en.y, en.radius)) continue;
        b.active = false;
        const destroyed = damageEnemy(en, particles, b.damage || 1);
        if (destroyed) {
          g.score += pointsFor(en);
          g.waveKills += 1;
          g.enemiesKilled += 1;
          audio.playExplosion();
          // Pas de shake sur un kill "classique" (réservé aux coups encaissés/
          // victoire boss), sinon l'écran tremble en permanence.
          triggerHitStop(g, en.type === "elite" ? 0.05 : 0.03);
          // Un seul bonus à la fois, aucun si déjà actif — évite le gâchis et
          // garde le HUD lisible.
          const noBonusInPlay = !player.buff && !player.shield && !powerups.items.some((pu) => pu.active);
          const dropChance = en.type === "elite" ? POWERUP.dropChanceElite : POWERUP.dropChanceNormal;
          if (noBonusInPlay && Math.random() < dropChance) {
            spawnPowerup(powerups, en.x, en.y, pickPowerupType());
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
        const res = hitBossWeakPoint(g.boss, b.x, b.y, pool.radius, particles, b.damage || 1);
        if (res) {
          b.active = false;
          if (res === true) {
            g.score += 300; // vaut un ennemi élite (TYPE_STATS.elite.points dans enemies.js)
            triggerShake(g, 6);
            triggerHitStop(g, 0.06);
            audio.playExplosion();
            if (g.boss.victory) {
              g.score += 1000; // bonus de victoire, nettement au-dessus d'un point faible pour marquer l'accomplissement
              player.lives = Math.min(PLAYER.maxLives, player.lives + 1); // récompense de victoire, plafonnée
              g.flash = Math.max(g.flash, 0.6);
              triggerShake(g, 14);
              triggerHitStop(g, 0.14);
              vibrate([40, 60, 40]);
              spawnExplosion(particles, g.boss.x, g.boss.y, 80, PALETTE.boss);
              spawnFlashBurst(particles, g.boss.x, g.boss.y, 24);
              triggerDeathStarLeave(starfield);
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

  // Corps des ennemis vs joueur
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

// NOVA : effet instantané (pas un buff) — détruit tous les ennemis actifs
// et leurs tirs en vol (sinon un mur de balles resterait mortel), jamais
// le boss (garde un vrai combat malgré un ramassage chanceux).
function triggerNova(g, engine) {
  const { audio, particles, enemies, projectiles } = engine;
  let killed = 0;
  for (const en of enemies.items) {
    if (!en.active) continue;
    en.active = false;
    spawnExplosion(particles, en.x, en.y, en.type === "elite" ? 20 : 12, enemyGlowColor(en));
    g.score += pointsFor(en);
    g.waveKills += 1;
    g.enemiesKilled += 1;
    killed++;
  }
  for (const eb of projectiles.enemy.items) {
    if (!eb.active) continue;
    eb.active = false;
    spawnSpark(particles, eb.x, eb.y, 3);
  }
  if (killed > 0) {
    audio.playNovaBlast();
    g.flash = Math.max(g.flash, 0.7);
    triggerShake(g, 12);
    g.banner = { text: "NOVA !", timer: 1.2 };
  }
}

// Déclenchement manuel de la jauge NOVA (touche Espace ou bouton tactile
// dédié, voir input.justPressed "NovaTrigger" dans main.js) — réutilise
// triggerNova() tel quel, seule la façon de l'obtenir/déclencher change.
function tryUseNova(g, engine) {
  if (g.novaStock <= 0) return;
  g.novaStock -= 1;
  triggerNova(g, engine);
}

// Récompense du niveau bonus (bonusLevel.js) : ajoutée à la jauge déjà en
// cours plutôt que de l'écraser (un run imparfait ne fait jamais reculer ce
// qui était déjà acquis par le graze), plafonnée au max courant.
function applyNovaReward(g, frac) {
  const max = g.novaMax;
  const units = Math.min(max, g.novaStock + g.novaProgress + frac * max);
  g.novaStock = Math.floor(units);
  g.novaProgress = units - g.novaStock;
}

// Coup absorbé par le bouclier : pas de vie perdue, réaction plus légère qu'un vrai impact.
function onShieldHit(g, engine) {
  triggerShake(g, 4);
  engine.audio.playBossHit();
  spawnExplosion(engine.particles, engine.player.x, engine.player.y, 10, PALETTE.shield);
}

function onPlayerHit(g, engine) {
  const { audio, particles, player } = engine;
  g.tookDamageThisWave = true; // casse l'éligibilité au bonus DIFFICULTY.noDamageWaveBonus — un coup absorbé par le bouclier (onShieldHit) ne compte pas, lui
  triggerShake(g, 10);
  triggerHitStop(g, 0.08);
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

// Dispatch commun d'un coup reçu par le joueur — bouclier ou vie perdue
// selon hitPlayer(), centralisé plutôt que répété par source de dégât.
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
  const t = Math.min(1, 1 - Math.max(0, timer) / duration);
  const eased = 1 - Math.pow(1 - t, 3);
  return startX + (targetX - startX) * eased;
}

// Glissée d'entrée (vague 1) : interpole la position directement (pas via
// updatePlayer) pour qu'un mouvement de souris ne la court-circuite pas.
// input.x/y n'est pas touché, donc le contrôle reprend sans saut à la fin.
function updateShipIntro(g, engine, dt) {
  g.shipIntroTimer -= dt;
  engine.player.x = easeInFromLeft(g.shipIntroTimer, SHIP_INTRO_DURATION, -20, RES_W * 0.18);
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
  const targetX = RES_W * 0.18;
  const bl = g.bonusLevel;
  if (bl.introTimer > 0) {
    // y immobile pendant la glissée — le contrôle reprend sans saut une
    // fois l'intro terminée (voir easeInFromLeft ci-dessus).
    player.x = easeInFromLeft(bl.introTimer, BONUS_LEVEL.introDuration, -20, targetX);
    player.y = RES_H / 2;
    return;
  }
  const dx = targetX - player.x;
  const maxStep = PLAYER.speed * dt;
  player.x = Math.abs(dx) <= maxStep ? targetX : player.x + Math.sign(dx) * maxStep;
  const dy = input.y - player.y;
  player.y = Math.abs(dy) <= maxStep ? input.y : player.y + Math.sign(dy) * maxStep;
  player.y = Math.max(6, Math.min(RES_H - 6, player.y));
}

export function update(g, engine, dt) {
  const { input, audio, player, projectiles, particles, enemies, powerups, starfield } = engine;

  // Micro-gel d'impact : dt réduit mais pas nul (un "punch" ressenti, pas
  // une vraie pause) — voir triggerHitStop().
  if (g.hitStop > 0) {
    g.hitStop = Math.max(0, g.hitStop - dt);
    dt *= 0.06;
  }

  if (g.dying) {
    // Ralenti après la mort — plus long/prononcé que le micro-gel
    // ci-dessus, tout continue de bouger mais au ralenti jusqu'à GAME OVER.
    g.deathTimer -= dt;
    dt *= 0.16;
    if (g.deathTimer <= 0) {
      g.dying = false;
      g.mode = MODE.GAME_OVER;
      // Rien ne décrémente g.shake hors d'ici — sans ce reset, un reliquat
      // de tremblement resterait figé sur GAME OVER.
      g.shake = 0;
      return;
    }
  } else {
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
      g.mode = MODE.PAUSED;
      g.pauseSelected = 0;
      g.pauseStage = "menu";
      return;
    }
    // "NovaTrigger" : jeton générique posé par le bouton tactile dédié
    // (main.js), consommé exactement comme une touche clavier. Inutile
    // pendant le niveau bonus (aucun ennemi normal à l'écran) — évite de
    // gâcher une charge sans effet.
    if (!g.clearingScreen && !g.bonusLevel && (consumeJustPressed(input, "Space") || consumeJustPressed(input, "NovaTrigger"))) {
      tryUseNova(g, engine);
    }
  }

  // Vagues / transition "saut spatial"
  if (g.waveBreak > 0) {
    g.waveBreak -= dt;
    const p = g.waveBreak / g.waveBreakDuration;
    g.warp = 1 + 9 * (1 - Math.abs(p - 0.5) * 2);
    g.clearingScreen = true;
    if (g.waveBreak <= 0) {
      g.warp = 1;
      g.clearingScreen = false;
      g.warpSoundPlayed = false;
      startWave(g, engine, g.wave + 1);
    }
  } else if (g.bonusLevel) {
    g.clearingScreen = true; // pas de tir pendant le niveau bonus, comme pendant un saut spatial
    g.warp = BONUS_LEVEL.warp;
    updateBonusLevel(g.bonusLevel, dt, player, particles, audio);
    if (g.bonusLevel.finished) {
      const frac = bonusLevelRewardFraction(g.bonusLevel);
      const passed = g.bonusLevel.passedCount;
      applyNovaReward(g, frac);
      g.bonusLevel = null;
      g.warp = 1;
      g.clearingScreen = false;
      g.waveBreakDuration = DIFFICULTY.waveBreakDuration;
      g.waveBreak = g.waveBreakDuration;
      g.banner = {
        text: `NIVEAU BONUS TERMINÉ : ${passed}/${BONUS_LEVEL.ringCount} ANNEAUX — NOVA +${Math.round(frac * 100)}%`,
        timer: g.waveBreakDuration,
      };
      if (!g.warpSoundPlayed) {
        audio.playWarpTransition();
        g.warpSoundPlayed = true;
      }
    }
  } else {
    g.clearingScreen = false;
    const waveDone = g.boss ? g.boss.victory : g.waveKills >= g.waveKillTarget;
    if (waveDone) {
      const nextWave = g.wave + 1;
      const bonusCycle = nextWave % BONUS_LEVEL.everyNWaves === 0 ? nextWave / BONUS_LEVEL.everyNWaves : 0;
      const bonusRequiredScore =
        bonusCycle === 1 ? BONUS_LEVEL.firstScoreThreshold : BONUS_LEVEL.scoreThreshold * bonusCycle;
      if (bonusCycle > 0 && nextWave !== g.bonusLevelLastWave && g.score >= bonusRequiredScore) {
        g.bonusLevelLastWave = nextWave;
        g.bonusLevel = createBonusLevel();
        // Glissée d'entrée du vaisseau (voir updateBonusLevelShip) — même
        // point de départ que l'intro de vague 1, le message explicatif
        // s'affiche pendant cette même phase (drawBonusLevelIntro).
        player.x = -20;
        player.y = RES_H / 2;
        setEnemiesLeaving(enemies);
        for (const b of projectiles.enemy.items) b.active = false;
        for (const pu of powerups.items) pu.active = false;
        return;
      }
      // Plus long après un boss (bossWaveBreakDuration) — le temps que le
      // décor et les derniers ennemis en fuite quittent l'écran.
      g.waveBreakDuration = g.boss ? DIFFICULTY.bossWaveBreakDuration : DIFFICULTY.waveBreakDuration;
      g.waveBreak = g.waveBreakDuration;
      g.flash = Math.max(g.flash, 0.3);
      if (!g.tookDamageThisWave) {
        g.score += DIFFICULTY.noDamageWaveBonus;
        g.banner = {
          text: `VAGUE ${g.wave} TERMINÉE — SANS DÉGÂTS ! +${DIFFICULTY.noDamageWaveBonus}`,
          timer: g.waveBreakDuration,
        };
        audio.playPowerup();
      } else {
        g.banner = { text: `VAGUE ${g.wave} TERMINÉE`, timer: g.waveBreakDuration };
      }
      // Tirs/bonus disparaissent immédiatement, mais les ennemis défilent
      // vers la gauche comme le fond (enemies.js) plutôt que de disparaître
      // d'un coup — le boss reste visible jusqu'à startWave (explosion de
      // victoire à l'écran).
      setEnemiesLeaving(enemies);
      for (const b of projectiles.enemy.items) b.active = false;
      for (const pu of powerups.items) pu.active = false;
      if (!g.warpSoundPlayed) {
        audio.playWarpTransition();
        g.warpSoundPlayed = true;
      }
    }
  }

  updateStarfield(starfield, dt, g.warp);

  if (g.banner) {
    g.banner.timer -= dt;
    if (g.banner.timer <= 0) g.banner = null;
  }

  g.shake = Math.max(0, g.shake - dt * 40);
  g.flash = Math.max(0, g.flash - dt * 1.5);
  g.controlHint = Math.max(0, g.controlHint - dt);

  updateProjectiles(projectiles, dt);
  updateParticles(particles, dt);
  updatePowerups(powerups, dt);

  updateEnemies(enemies, dt, projectiles, player, g.wave, g.warp);

  if (g.boss) {
    updateBoss(g.boss, dt, projectiles, player);
  } else if (g.waveBreak <= 0 && !g.bonusLevel) {
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0) {
      spawnEnemyWave(enemies, g.wave, eliteChance(g));
      g.spawnTimer = Math.max(0.12, g.spawnInterval + (Math.random() - 0.5) * 0.15);
    }
  }

  resolveCollisions(g, engine);
  // Après resolveCollisions() : un tir qui a touché ce frame est déjà
  // désactivé, donc jamais compté comme un graze en plus d'un vrai coup.
  updateGraze(g, dt, player, projectiles, enemies, particles, audio);
}

// Rendu de la scène de jeu — aussi appelé pour PAUSED/GAME_OVER (voir le
// commentaire en tête de fichier) : ces deux écrans dessinent leur overlay
// par-dessus après cet appel (voir game.js, draw()).
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
