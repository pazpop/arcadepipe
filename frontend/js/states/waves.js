// Vagues : démarrage d'une vague (statistiques, boss ou non) et transition
// entre deux vagues (saut spatial, déclenchement/conclusion du niveau
// bonus) — extrait de states/playing.js (voir ROADMAP.md, Session 1) sur le
// même patron que bonusLevel.js : son propre minuteur (g.waveBreak), ses
// propres champs g, peu de dépendances croisées avec le reste de "playing".
import { RES_H, DIFFICULTY, BONUS_LEVEL } from "../config.js";
import { spawnDeathStarBackdrop } from "../stars.js";
import { spawnBoss } from "../boss.js";
import { novaMaxForWave } from "../graze.js";
import { createBonusLevel, updateBonusLevel, bonusLevelRewardFraction } from "../bonusLevel.js";
import { setEnemiesLeaving } from "../enemies.js";

function isBossWave(wave) {
  return wave % DIFFICULTY.bossWaveEvery === 0;
}

export function startWave(g, engine, wave) {
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

// Récompense du niveau bonus (bonusLevel.js) : ajoutée à la jauge déjà en
// cours plutôt que de l'écraser (un run imparfait ne fait jamais reculer ce
// qui était déjà acquis par le graze), plafonnée au max courant. Un des 3
// écrivains de g.novaStock/g.novaProgress — voir la cartographie complète
// dans states/playing.js, juste avant triggerNova().
function applyNovaReward(g, frac) {
  const max = g.novaMax;
  const units = Math.min(max, g.novaStock + g.novaProgress + frac * max);
  g.novaStock = Math.floor(units);
  g.novaProgress = units - g.novaStock;
}

// Transition entre deux vagues (saut spatial, g.waveBreak) et cycle du
// niveau bonus (déclenchement à la fin d'une vague éligible, conclusion à
// sa toute fin) — un seul bloc plutôt que 3 fonctions séparées : ces 3
// phases s'enchaînent et s'excluent mutuellement (jamais deux en même temps).
//
// Retourne true si le reste de update() (states/playing.js, l'appelant) doit
// être sauté pour cette frame — seul le déclenchement d'un niveau bonus le
// demande, pour laisser sa glissée d'entrée démarrer proprement avant que le
// reste de la frame ne retouche la position du vaisseau.
export function updateWaveTransition(g, engine, dt) {
  const { player, projectiles, particles, powerups, enemies, audio } = engine;

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
    return false;
  }

  if (g.bonusLevel) {
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
    return false;
  }

  g.clearingScreen = false;
  const waveDone = g.boss ? g.boss.victory : g.waveKills >= g.waveKillTarget;
  if (!waveDone) return false;

  const nextWave = g.wave + 1;
  const bonusCycle = nextWave % BONUS_LEVEL.everyNWaves === 0 ? nextWave / BONUS_LEVEL.everyNWaves : 0;
  const bonusRequiredScore =
    bonusCycle === 1 ? BONUS_LEVEL.firstScoreThreshold : BONUS_LEVEL.scoreThreshold * bonusCycle;
  if (bonusCycle > 0 && nextWave !== g.bonusLevelLastWave && g.score >= bonusRequiredScore) {
    g.bonusLevelLastWave = nextWave;
    g.bonusLevel = createBonusLevel();
    // Glissée d'entrée du vaisseau (voir updateBonusLevelShip dans
    // states/playing.js) — même point de départ que l'intro de vague 1, le
    // message explicatif s'affiche pendant cette même phase (drawBonusLevelIntro).
    player.x = -20;
    player.y = RES_H / 2;
    setEnemiesLeaving(enemies);
    for (const b of projectiles.enemy.items) b.active = false;
    for (const pu of powerups.items) pu.active = false;
    return true; // glissée d'entrée à laisser démarrer proprement, voir ci-dessus
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
  return false;
}
