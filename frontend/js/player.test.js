// Tests du vaisseau (player.js) : règle d'apparition des bonus, cadence de tir.
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { createPlayer, applyPowerup, applyShield, canReceivePowerup, updatePlayer } from "./player.js";
import { createProjectiles } from "./projectiles.js";
import { deactivateAll } from "./pool.js";
import { PLAYER } from "./config.js";

test("sans bonus : une arme comme un bouclier peuvent apparaître", () => {
  const player = createPlayer();
  assert.equal(canReceivePowerup(player, "power"), true);
  assert.equal(canReceivePowerup(player, "shield"), true);
});

test("arme bonus active : aucune autre arme, mais un bouclier oui", () => {
  const player = createPlayer();
  applyPowerup(player, "rapid");
  for (const weapon of ["power", "rapid", "shotgun"]) assert.equal(canReceivePowerup(player, weapon), false);
  assert.equal(canReceivePowerup(player, "shield"), true);
});

test("bouclier actif : aucun autre bouclier, mais une arme oui", () => {
  const player = createPlayer();
  applyShield(player, 3);
  assert.equal(canReceivePowerup(player, "shield"), false);
  assert.equal(canReceivePowerup(player, "shotgun"), true);
});

// Tirs partis en dix secondes de tir automatique, pour des images de `dt` secondes.
function shotsInTenSeconds(dt) {
  const player = createPlayer();
  const projectiles = createProjectiles();
  const input = { x: player.x, y: player.y, fireHeld: false, autoFire: true };
  let shots = 0;
  for (let t = 0; t < 10; t += dt) {
    updatePlayer(player, input, projectiles, dt, () => shots++, true);
    deactivateAll(projectiles.player); // seul le nombre de tirs compte ici
  }
  return shots;
}

test("cadence de tir : la même quelle que soit la fréquence de l'écran", () => {
  const expected = 10 / PLAYER.fireCooldown;
  for (const hz of [60, 144, 240]) {
    const shots = shotsInTenSeconds(1 / hz);
    assert.ok(Math.abs(shots - expected) <= 1, `${hz} Hz : ${shots} tirs, ${Math.round(expected)} attendus`);
  }
});

test("cadence de tir : pas de rafale au moment où le tir reprend", () => {
  const player = createPlayer();
  const projectiles = createProjectiles();
  const input = { x: player.x, y: player.y, fireHeld: false, autoFire: false };
  let shots = 0;
  const step = () => updatePlayer(player, input, projectiles, 1 / 60, () => shots++, true);
  for (let i = 0; i < 300; i++) step(); // cinq secondes sans tirer
  input.fireHeld = true;
  for (let i = 0; i < 6; i++) step(); // un dixième de seconde : un seul tir (fireCooldown 0,11 s)
  assert.equal(shots, 1);
});
