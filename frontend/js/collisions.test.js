// Tests pour collisions.js — logique pure, aucune dépendance DOM/Canvas.
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { circlesOverlap } from "./collisions.js";

test("cercles qui se chevauchent nettement", () => {
  assert.equal(circlesOverlap(0, 0, 5, 3, 0, 5), true);
});

test("cercles trop éloignés pour se toucher", () => {
  assert.equal(circlesOverlap(0, 0, 1, 100, 0, 1), false);
});

test("cercles exactement tangents (limite incluse)", () => {
  // distance = 10, r1 + r2 = 10 : dx²+dy² <= r² doit être vrai à l'égalité.
  assert.equal(circlesOverlap(0, 0, 4, 10, 0, 6), true);
});

test("un cercle juste au-delà de la tangence ne touche pas", () => {
  assert.equal(circlesOverlap(0, 0, 4, 10.01, 0, 6), false);
});

test("symétrique : peu importe l'ordre des deux cercles", () => {
  const a = circlesOverlap(2, 3, 1.5, 4, 1, 2);
  const b = circlesOverlap(4, 1, 2, 2, 3, 1.5);
  assert.equal(a, b);
});
