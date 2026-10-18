// Tirs courbes du boss : ils doivent finir par quitter l'écran.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProjectiles, updateProjectiles } from "./projectiles.js";
import { patternFan, patternRing } from "./patterns.js";

function activeAfter(projectiles, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) updateProjectiles(projectiles, 1 / 60);
  return projectiles.enemy.items.filter((b) => b.active).length;
}

test("éventail courbe : tous les tirs ont quitté l'écran après 20 s", () => {
  const projectiles = createProjectiles();
  patternFan(projectiles, 400, 135, { x: 80, y: 135 }, 60, 8, Math.PI / 2.2, 0.6);
  assert.equal(activeAfter(projectiles, 20), 0);
});

test("éventail impair : le tir du milieu vise la cible", () => {
  const projectiles = createProjectiles();
  patternFan(projectiles, 400, 135, { x: 100, y: 135 }, 60, 5, Math.PI / 2.2, 0.6);
  const middle = projectiles.enemy.items.filter((b) => b.active)[2];
  assert.ok(Math.abs(middle.vy) < 1e-9 && middle.vx < 0);
  assert.equal(middle.turnRate, 0);
});

test("anneau courbe : tous les tirs ont quitté l'écran après 20 s", () => {
  const projectiles = createProjectiles();
  patternRing(projectiles, 400, 135, 0, 60, 12, 0.5);
  assert.equal(activeAfter(projectiles, 20), 0);
});

test("anneau : l'angle de départ décale tous les tirs", () => {
  const directions = (angle) => {
    const projectiles = createProjectiles();
    patternRing(projectiles, 400, 135, angle, 60, 12, 0);
    return projectiles.enemy.items.filter((b) => b.active).map((b) => Math.atan2(b.vy, b.vx).toFixed(3));
  };
  const first = directions(0);
  assert.equal(first.length, 12);
  assert.ok(directions(0.4).every((d) => !first.includes(d)));
});
