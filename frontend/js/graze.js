// Frôlement des tirs ennemis ET du corps des ennemis eux-mêmes (voler près
// d'un vaisseau compte, pas seulement esquiver ce qu'il tire) : récompense
// l'esquive serrée plutôt que large. Le boss fait exception — seuls ses tirs
// grazent, jamais sa coque (voir updateGraze plus bas). Alimente la jauge
// NOVA (game.js) plutôt que le score seul, pour donner un objectif tactile à
// chaque frôlement plutôt qu'un simple nombre qui monte.
import { GRAZE, NOVA, DIFFICULTY } from "./config.js";
import { circlesOverlap } from "./collisions.js";
import { spawnSpark } from "./particles.js";

export function grazeScoreForChain(chain) {
  return GRAZE.baseScore * chain;
}

// Dérivé de bossWaveEvery (même convention que isFirstBoss dans boss.js)
// plutôt qu'un numéro de vague en dur.
export function novaMaxForWave(wave) {
  return wave >= DIFFICULTY.bossWaveEvery * NOVA.extraStockFromBossCount ? 2 : NOVA.baseMaxStock;
}

function registerGraze(g, particles, audio, x, y) {
  g.grazeChain += 1;
  g.score += grazeScoreForChain(g.grazeChain);
  g.novaProgress += 1 / GRAZE.grazePerCharge;
  while (g.novaProgress >= 1 && g.novaStock < g.novaMax) {
    g.novaProgress -= 1;
    g.novaStock += 1;
  }
  if (g.novaStock >= g.novaMax) g.novaProgress = 0; // jauge pleine : pas de trop-plein visuel sur la barre de progression
  spawnSpark(particles, x, y, 2);
  // Palier plafonné : sans ça, une chaîne longue en fin de vague chargée
  // donnerait un son de plus en plus aigu jusqu'à l'insupportable.
  audio.playGraze(Math.min(g.grazeChain, 8));
}

// Suspendu pendant : l'invulnérabilité post-hit (sinon trivial à spammer en
// restant dans un tir), la transition de vague et le ralenti de mort
// (g.dying) — leur dt n'est que réduit, jamais nul (voir updatePlayingMode
// dans game.js), donc sans cette garde la jauge continuerait de se remplir
// un peu pendant ces phases où le joueur ne "joue" pas vraiment.
export function updateGraze(g, dt, player, projectiles, enemies, particles, audio) {
  if (!player.alive || player.invuln > 0 || g.waveBreak > 0 || g.dying || g.shipIntro) return;

  for (const b of projectiles.enemy.items) {
    if (!b.active || b.grazed) continue;
    if (circlesOverlap(b.x, b.y, projectiles.enemy.radius, player.x, player.y, GRAZE.radius)) {
      b.grazed = true;
      registerGraze(g, particles, audio, b.x, b.y);
    }
  }

  // Corps des ennemis normaux (pool `enemies`) — le boss n'en fait jamais
  // partie (objet séparé, `g.boss`), donc il est exclu par construction :
  // seuls ses tirs, déjà traités ci-dessus via projectiles.enemy, le font grazer.
  for (const en of enemies.items) {
    if (!en.active) continue;
    if (en.grazeCooldown > 0) {
      en.grazeCooldown = Math.max(0, en.grazeCooldown - dt);
      continue;
    }
    if (circlesOverlap(en.x, en.y, en.radius, player.x, player.y, GRAZE.radius)) {
      en.grazeCooldown = GRAZE.bodyCooldown;
      registerGraze(g, particles, audio, en.x, en.y);
    }
  }
}
