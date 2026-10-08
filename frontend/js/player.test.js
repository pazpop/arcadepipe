// Tests pour la règle d'apparition des bonus (player.js).
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { createPlayer, applyPowerup, applyShield, canReceivePowerup } from "./player.js";

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
