// Tests des ennemis (enemies.js) : tir jamais vers l'arrière, kamikaze, formation.
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { createEnemyPool, formationCountdownForWave, spawnFormation, spawnNext, updateEnemies } from "./enemies.js";
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
  assert.ok(Math.abs(upper.y + lower.y - leader.y * 2) < 1e-9); // les ailiers encadrent le meneur
});

test("formation : jamais en vague 1, et pas à chaque vague ensuite", () => {
  const draws = (wave) => Array.from({ length: 300 }, () => formationCountdownForWave(wave));
  assert.ok(draws(1).every((n) => n === -1));
  const later = draws(5);
  assert.ok(later.includes(-1));
  assert.ok(later.some((n) => n >= 2));
  assert.ok(later.every((n) => n === -1 || (n >= 2 && n <= 6)));
});

test("kamikaze : parti du bord droit, il atteint un joueur resté tout à gauche", () => {
  const pool = createEnemyPool();
  const projectiles = createProjectiles();
  const player = { x: 20, y: 135 };
  Object.assign(pool.items[0], { active: true, type: "kamikaze", x: 490, y: 60, vx: -70, vy: 0, elapsed: 0 });
  let closest = Infinity;
  for (let t = 0; t < 12 && pool.items[0].active; t += 1 / 60) {
    updateEnemies(pool, 1 / 60, projectiles, player, 4, 1);
    closest = Math.min(closest, Math.hypot(pool.items[0].x - player.x, pool.items[0].y - player.y));
  }
  assert.ok(closest < 6, `au plus près : ${closest.toFixed(1)} px`);
});

test("formation : elle évite un ennemi déjà sur sa route", () => {
  for (let run = 0; run < 300; run++) {
    const pool = createEnemyPool();
    Object.assign(pool.items[0], { active: true, type: "normal", x: 484, y: 135, radius: 4.5 });
    spawnFormation(pool);
    const trio = pool.items.filter((en, i) => en.active && i > 0);
    assert.ok(trio.every((en) => Math.hypot(en.x - 484, en.y - 135) >= 14));
  }
});

test("vague : la formation passe une seule fois, quand son tour arrive", () => {
  const pool = createEnemyPool();
  let countdown = 2;
  const counts = [];
  for (let i = 0; i < 5; i++) {
    countdown = spawnNext(pool, 2, countdown);
    counts.push(pool.items.filter((en) => en.active).length);
  }
  assert.deepEqual(counts, [1, 2, 5, 6, 7]);
});
