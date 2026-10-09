// Tests pour graze.js : score d'une chaîne, charges NOVA, updateGraze.
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { addNovaGrazes, grazeScoreForChain, novaMaxForWave, updateGraze } from "./graze.js";
import { GRAZE, DIFFICULTY } from "./config.js";
import { createParticlePool } from "./particles.js";

test("le score d'un graze scale avec la taille de la chaîne", () => {
  assert.equal(grazeScoreForChain(1), GRAZE.baseScore);
  assert.equal(grazeScoreForChain(4), GRAZE.baseScore * 4);
});

test("le multiplicateur de chaîne est plafonné", () => {
  const max = GRAZE.maxChainMultiplier;
  assert.equal(grazeScoreForChain(max + 500), GRAZE.baseScore * max);
});

test("avant la vague du 2e boss : une seule charge NOVA max", () => {
  assert.equal(novaMaxForWave(1), 1);
  assert.equal(novaMaxForWave(DIFFICULTY.bossWaveEvery * 2 - 1), 1);
});

test("dès la vague du 2e boss : deux charges NOVA max", () => {
  assert.equal(novaMaxForWave(DIFFICULTY.bossWaveEvery * 2), 2);
  assert.equal(novaMaxForWave(DIFFICULTY.bossWaveEvery * 2 + 3), 2);
});

// Garde de updateGraze() pendant g.clearingScreen (niveau bonus, saut
// spatial) : sans elle, ce scénario graze bien (voir le test de contrôle).
function makeGrazeFixture() {
  const g = { grazeChain: 0, maxGrazeChain: 0, score: 0, novaGrazes: 0, novaStock: 0, novaMax: 1, clearingScreen: false };
  const player = { alive: true, invuln: 0, x: 0, y: 0 };
  // Même position que le joueur : chevauchement garanti quel que soit le rayon.
  const projectiles = { enemy: { items: [{ active: true, grazed: false, x: 0, y: 0 }], radius: 1 } };
  const enemies = { items: [] };
  const particles = createParticlePool();
  const audio = { playGraze: () => {}, playGrazeMilestone: () => {} };
  return { g, player, projectiles, enemies, particles, audio };
}

test("le graze ne progresse pas pendant clearingScreen (niveau bonus/saut spatial)", () => {
  const { g, player, projectiles, enemies, particles, audio } = makeGrazeFixture();
  g.clearingScreen = true;
  updateGraze(g, 0.016, player, projectiles, enemies, particles, audio);
  assert.equal(g.grazeChain, 0);
  assert.equal(g.novaGrazes, 0);
  assert.equal(projectiles.enemy.items[0].grazed, false);
});

test("contrôle : le même scénario graze bien hors clearingScreen", () => {
  const { g, player, projectiles, enemies, particles, audio } = makeGrazeFixture();
  updateGraze(g, 0.016, player, projectiles, enemies, particles, audio);
  assert.equal(g.grazeChain, 1);
  assert.equal(projectiles.enemy.items[0].grazed, true);
});

test("un seuil de chaîne (GRAZE.milestones) joue le son de palier, pas le tic habituel", () => {
  const { g, player, projectiles, enemies, particles } = makeGrazeFixture();
  const played = [];
  const audio = { playGraze: () => played.push("tic"), playGrazeMilestone: () => played.push("palier") };
  g.grazeChain = GRAZE.milestones[0] - 2;
  updateGraze(g, 0.016, player, projectiles, enemies, particles, audio);
  projectiles.enemy.items[0].grazed = false; // même tir, frôlé une 2e fois
  updateGraze(g, 0.016, player, projectiles, enemies, particles, audio);
  assert.deepEqual(played, ["tic", "palier"]);
});

// Charge NOVA : comptée en frôlements entiers, quel que soit GRAZE.grazePerCharge.
for (const perCharge of [10, 12]) {
  test(`${perCharge} frôlements par charge : la charge arrive au ${perCharge}e, pas avant ni après`, () => {
    const saved = GRAZE.grazePerCharge;
    GRAZE.grazePerCharge = perCharge;
    try {
      const { g, player, projectiles, enemies, particles, audio } = makeGrazeFixture();
      for (let i = 1; i <= perCharge; i++) {
        projectiles.enemy.items[0].grazed = false;
        updateGraze(g, 0.016, player, projectiles, enemies, particles, audio);
        assert.equal(g.novaStock, i === perCharge ? 1 : 0, `après ${i} frôlements`);
      }
    } finally {
      GRAZE.grazePerCharge = saved;
    }
  });
}
test("la jauge NOVA ne dépasse jamais sa réserve maximale", () => {
  const g = { novaStock: 1, novaGrazes: 5, novaMax: 2 };
  addNovaGrazes(g, 10 * GRAZE.grazePerCharge);
  assert.deepEqual([g.novaStock, g.novaGrazes], [2, 0]);
});
