// Vagues : démarrage d'une vague (boss ou non) et transition entre deux
// vagues (saut spatial, niveau bonus).
import { RES_H, DIFFICULTY, BONUS_LEVEL, PLAYER } from "../config.js";
import { spawnBossBackdrop } from "../stars.js";
import { spawnBoss } from "../boss.js";
import { novaMaxForWave } from "../graze.js";
import { createBonusLevel, updateBonusLevel, bonusLevelRewardFraction } from "../bonusLevel.js";
import { setEnemiesLeaving } from "../enemies.js";
import { t } from "../i18n.js";

function isBossWave(wave) {
  return wave % DIFFICULTY.bossWaveEvery === 0;
}

export function startWave(g, engine, wave) {
  g.wave = wave;
  g.waveKills = 0;
  g.tookDamageThisWave = false;
  g.intactBlink = 0;
  g.grazeChain = 0;
  g.novaMax = novaMaxForWave(wave);
  g.waveKillTarget = DIFFICULTY.baseWaveKills + (wave - 1) * DIFFICULTY.waveKillsStep;
  g.spawnInterval = Math.max(
    DIFFICULTY.minSpawnInterval,
    DIFFICULTY.baseSpawnInterval - (wave - 1) * DIFFICULTY.spawnIntervalStep
  );
  g.waveBreak = 0;
  g.clearingScreen = false;
  g.boss = null;
  if (isBossWave(wave)) {
    g.banner = { text: t("banner.bossWave", { wave }), timer: 2.5 };
    g.boss = spawnBoss(wave);
    spawnBossBackdrop(engine.starfield);
  } else {
    g.banner = { text: t("hud.wave", { wave }), timer: 1.8 };
    engine.starfield.bossBackdrop = null; // rejouer après une mort en plein combat de boss
  }
}

// Récompense du niveau bonus (bonusLevel.js) : ajoutée à la jauge NOVA en
// cours, plafonnée au max courant.
function applyNovaReward(g, frac) {
  const max = g.novaMax;
  const units = Math.min(max, g.novaStock + g.novaProgress + frac * max);
  g.novaStock = Math.floor(units);
  g.novaProgress = units - g.novaStock;
}

// Appelée à chaque frame de la partie. Trois phases qui s'excluent : le saut
// spatial entre deux vagues (g.waveBreak), le niveau bonus (g.bonusLevel), et
// la vague elle-même, dont on guette la fin. g.clearingScreen est vrai pendant
// les deux premières : ni tirs, ni collisions, ni frôlements.
export function updateWaveTransition(g, engine, dt) {
  const { player, projectiles, particles, powerups, enemies, audio } = engine;

  if (g.waveBreak > 0) {
    g.waveBreak -= dt;
    const p = g.waveBreak / g.waveBreakDuration;
    g.warp = 1 + 9 * (1 - Math.abs(p - 0.5) * 2);
    if (g.waveBreak <= 0) {
      g.warp = 1;
      startWave(g, engine, g.wave + 1);
    }
    return;
  }

  if (g.bonusLevel) {
    g.warp = BONUS_LEVEL.warp;
    updateBonusLevel(g.bonusLevel, dt, player, particles, audio);
    if (g.bonusLevel.finished) {
      const frac = bonusLevelRewardFraction(g.bonusLevel);
      const passed = g.bonusLevel.passedCount;
      applyNovaReward(g, frac);
      g.bonusLevel = null;
      g.banner = { text: t("banner.bonusDone", { passed, total: BONUS_LEVEL.ringCount, percent: Math.round(frac * 100) }) };
      startWaveBreak(g, audio, DIFFICULTY.waveBreakDuration);
    }
    return;
  }

  const waveDone = g.boss ? g.boss.victory : g.waveKills >= g.waveKillTarget;
  if (!waveDone) return;

  // Fin de vague. Tirs et bonus disparaissent ; les ennemis défilent vers la
  // gauche comme le fond.
  g.clearingScreen = true;
  setEnemiesLeaving(enemies);
  for (const b of projectiles.enemy.items) b.active = false;
  for (const pu of powerups.items) pu.active = false;
  if (g.tookDamageThisWave) {
    g.banner = { text: t("banner.waveDone", { wave: g.wave }) };
  } else {
    g.score += DIFFICULTY.noDamageWaveBonus;
    g.banner = { text: t("banner.waveDoneIntact", { wave: g.wave, bonus: DIFFICULTY.noDamageWaveBonus }) };
    audio.playPowerup();
  }

  // Niveau bonus avant la prochaine vague, si elle est éligible et le score suffisant.
  const nextWave = g.wave + 1;
  const bonusCycle = nextWave % BONUS_LEVEL.everyNWaves === 0 ? nextWave / BONUS_LEVEL.everyNWaves : 0;
  const bonusRequiredScore =
    bonusCycle === 1 ? BONUS_LEVEL.firstScoreThreshold : BONUS_LEVEL.scoreThreshold * bonusCycle;
  if (bonusCycle > 0 && g.score >= bonusRequiredScore) {
    g.bonusLevel = createBonusLevel();
    g.banner.timer = BONUS_LEVEL.introDuration;
    // Départ de la glissée d'entrée du vaisseau (updateBonusLevelShip, states/playing.js).
    player.x = PLAYER.entryX;
    player.y = RES_H / 2;
    return;
  }

  // Saut plus long après un boss : le temps que le décor quitte l'écran.
  g.flash = Math.max(g.flash, 0.3);
  startWaveBreak(g, audio, g.boss ? DIFFICULTY.bossWaveBreakDuration : DIFFICULTY.waveBreakDuration);
}

// Saut spatial vers la vague suivante ; la bannière en cours reste affichée jusqu'au bout.
function startWaveBreak(g, audio, duration) {
  g.waveBreakDuration = duration;
  g.waveBreak = duration;
  g.banner.timer = duration;
  g.clearingScreen = true;
  audio.playWarpTransition();
}
