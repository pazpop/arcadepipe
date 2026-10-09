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

test("anneau courbe : tous les tirs ont quitté l'écran après 20 s", () => {
  const projectiles = createProjectiles();
  patternRing(projectiles, 400, 135, 60, 12, 0.5);
  assert.equal(activeAfter(projectiles, 20), 0);
});
