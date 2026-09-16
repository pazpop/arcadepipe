// Tests pour bulletSpeedFactor() (config.js) — logique pure.
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { bulletSpeedFactor, DIFFICULTY } from "./config.js";

test("vague 1 : facteur neutre (pas d'accélération)", () => {
  assert.equal(bulletSpeedFactor(1), 1);
});

test("le facteur augmente avec la vague", () => {
  assert.ok(bulletSpeedFactor(5) > bulletSpeedFactor(2));
});

test("le facteur est plafonné à bulletSpeedCap", () => {
  const facteur = bulletSpeedFactor(1000);
  assert.equal(facteur, DIFFICULTY.bulletSpeedCap);
});

test("le facteur ne dépasse jamais le plafond, même juste avant", () => {
  const vagueAvantPlafond = Math.ceil(
    (DIFFICULTY.bulletSpeedCap - 1) / DIFFICULTY.bulletSpeedGrowthPerWave,
  );
  assert.ok(bulletSpeedFactor(vagueAvantPlafond) <= DIFFICULTY.bulletSpeedCap);
});
