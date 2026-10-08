// Tests pour le tir des ennemis (enemies.js) : jamais vers l'arrière.
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { createEnemyPool, updateEnemies } from "./enemies.js";
import { createProjectiles } from "./projectiles.js";

// Un ennemi prêt à tirer (fireTimer 0), au centre, qui vole vers la gauche.
function shotsFired(overrides, playerX) {
  const pool = createEnemyPool();
  const projectiles = createProjectiles();
  Object.assign(pool.items[0], { active: true, type: "elite", x: 300, y: 135, vx: -45, vy: 0, fireTimer: 0, ...overrides });
  updateEnemies(pool, 0.016, projectiles, { x: playerX, y: 135 }, 5);
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
