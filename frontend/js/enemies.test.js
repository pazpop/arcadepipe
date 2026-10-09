// Tests pour le tir des ennemis (enemies.js) : jamais vers l'arrière.
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { createEnemyPool, formationCountdownForWave, spawnFormation, updateEnemies } from "./enemies.js";
import { createProjectiles } from "./projectiles.js";

// Un ennemi prêt à tirer (fireTimer 0), au centre, qui vole vers la gauche.
function shotsFired(overrides, playerX) {
  const pool = createEnemyPool();
  const projectiles = createProjectiles();
  Object.assign(pool.items[0], { active: true, type: "elite", x: 300, y: 135, vx: -45, vy: 0, fireTimer: 0, ...overrides });
  updateEnemies(pool, 0.016, projectiles, { x: playerX, y: 135 }, 5, 1);
  return projectiles.enemy.items.filter((b) => b.active);
}

for (const [label, overrides] of [["élite", {}], ["gunner", { type: "normal", gunner: true }]]) {
  test(`${label} : tire sur un joueur devant lui`, () => {
    const shots = shotsFired(overrides, 60);
    assert.equal(shots.length, 1);
    assert.ok(shots[0].vx < 0);
  });

  test(`${label} : ne tire pas sur un joueur derrière lui`, () => {
    assert.equal(shotsFired(overrides, 440).length, 0);
  });
}

test("kamikaze : cesse de poursuivre un joueur immobile et quitte l'écran", () => {
  const pool = createEnemyPool();
  const projectiles = createProjectiles();
  // Lancé de côté, tout près du joueur : la position d'où il tournerait en rond.
  Object.assign(pool.items[0], { active: true, type: "kamikaze", x: 100, y: 110, vx: -70, vy: 0, elapsed: 0 });
  for (let t = 0; t < 30; t += 1 / 60) updateEnemies(pool, 1 / 60, projectiles, { x: 86, y: 135 }, 4, 1);
  assert.equal(pool.items[0].active, false);
});

test("formation : trois ennemis normaux en flèche, meneur devant, qui restent à l'écran", () => {
  const pool = createEnemyPool();
  const projectiles = createProjectiles();
  spawnFormation(pool);
  updateEnemies(pool, 1 / 60, projectiles, { x: 86, y: 135 }, 2, 1);
  const trio = pool.items.filter((en) => en.active);
  assert.equal(trio.length, 3);
  assert.ok(trio.every((en) => en.type === "normal" && !en.gunner && en.vx === trio[0].vx && en.vy === 0));
  const [leader, upper, lower] = trio;
  assert.ok(leader.x < upper.x && upper.x === lower.x);
  assert.equal(upper.y + lower.y, leader.y * 2);
});

test("formation : jamais en vague 1, et pas à chaque vague ensuite", () => {
  const draws = (wave) => Array.from({ length: 300 }, () => formationCountdownForWave(wave));
  assert.ok(draws(1).every((n) => n === -1));
  const later = draws(5);
  assert.ok(later.includes(-1));
  assert.ok(later.some((n) => n >= 2));
  assert.ok(later.every((n) => n === -1 || (n >= 2 && n <= 6)));
});
