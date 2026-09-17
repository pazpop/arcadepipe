// Tests pour bonusLevelRewardFraction() (bonusLevel.js) — logique pure.
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { bonusLevelRewardFraction } from "./bonusLevel.js";
import { BONUS_LEVEL } from "./config.js";

test("aucun anneau réussi -> récompense nulle", () => {
  assert.equal(bonusLevelRewardFraction({ passedCount: 0 }), 0);
});

test("tous les anneaux réussis -> récompense de 1 (jauge pleine)", () => {
  assert.equal(bonusLevelRewardFraction({ passedCount: BONUS_LEVEL.ringCount }), 1);
});

test("la moitié des anneaux réussis -> récompense proportionnelle", () => {
  const half = BONUS_LEVEL.ringCount / 2;
  assert.equal(bonusLevelRewardFraction({ passedCount: half }), 0.5);
});

test("aucun niveau bonus en cours -> récompense nulle plutôt qu'une erreur", () => {
  assert.equal(bonusLevelRewardFraction(null), 0);
});
