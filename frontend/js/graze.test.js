// Tests pour grazeScoreForChain()/novaMaxForWave() (graze.js) — logique pure.
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { grazeScoreForChain, novaMaxForWave, updateGraze } from "./graze.js";
import { GRAZE, DIFFICULTY } from "./config.js";
import { createParticlePool } from "./particles.js";

test("le score d'un graze scale avec la taille de la chaîne", () => {
  assert.equal(grazeScoreForChain(1), GRAZE.baseScore);
  assert.equal(grazeScoreForChain(4), GRAZE.baseScore * 4);
});

test("avant la vague du 2e boss : une seule charge NOVA max", () => {
  assert.equal(novaMaxForWave(1), 1);
  assert.equal(novaMaxForWave(DIFFICULTY.bossWaveEvery * 2 - 1), 1);
});

test("dès la vague du 2e boss : deux charges NOVA max", () => {
  assert.equal(novaMaxForWave(DIFFICULTY.bossWaveEvery * 2), 2);
  assert.equal(novaMaxForWave(DIFFICULTY.bossWaveEvery * 2 + 3), 2);
});

// Fige la garde ajoutée après une trouvaille de revue d'architecture : le
// niveau bonus (et le saut spatial) mettent g.clearingScreen à true et
// vident les pools ennemis/tirs — updateGraze() n'avait jusqu'ici aucune
// vérification de son cru, protégé seulement par cette coïncidence de
// données (rien à grazer une fois les pools vides). Ce test grazerait bel
// et bien sans la garde (voir le test de contrôle juste en dessous), pour
// ne plus dépendre uniquement de cette coïncidence si un futur hasard du
// niveau bonus réintroduit quelque chose à grazer.
function makeGrazeFixture() {
  const g = { grazeChain: 0, maxGrazeChain: 0, score: 0, novaProgress: 0, novaStock: 0, novaMax: 1, clearingScreen: false };
  const player = { alive: true, invuln: 0, x: 0, y: 0 };
  // Même position que le joueur : chevauchement garanti quel que soit le rayon.
  const projectiles = { enemy: { items: [{ active: true, grazed: false, x: 0, y: 0 }], radius: 1 } };
  const enemies = { items: [] };
  const particles = createParticlePool();
  const audio = { playGraze: () => {} };
  return { g, player, projectiles, enemies, particles, audio };
}

test("le graze ne progresse pas pendant clearingScreen (niveau bonus/saut spatial)", () => {
  const { g, player, projectiles, enemies, particles, audio } = makeGrazeFixture();
  g.clearingScreen = true;
  updateGraze(g, 0.016, player, projectiles, enemies, particles, audio);
  assert.equal(g.grazeChain, 0);
  assert.equal(g.novaProgress, 0);
  assert.equal(projectiles.enemy.items[0].grazed, false);
});

test("contrôle : le même scénario graze bien hors clearingScreen", () => {
  const { g, player, projectiles, enemies, particles, audio } = makeGrazeFixture();
  updateGraze(g, 0.016, player, projectiles, enemies, particles, audio);
  assert.equal(g.grazeChain, 1);
  assert.equal(projectiles.enemy.items[0].grazed, true);
});
