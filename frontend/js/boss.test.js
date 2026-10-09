import { test } from "node:test";
import assert from "node:assert/strict";
import { hitBossWeakPoint } from "./boss.js";

// Un boss réduit à ce que lit hitBossWeakPoint : un seul point faible, à 1 PV, en son centre.
function bossWithOneWeakPoint(arrived) {
  return { arrived, x: 300, y: 135, victory: false, weakPoints: [{ ox: 0, oy: 0, hp: 1, destroyed: false }] };
}
const noParticles = { items: [] };

test("le boss est invulnérable tant qu'il n'est pas arrivé", () => {
  const boss = bossWithOneWeakPoint(false);
  assert.equal(hitBossWeakPoint(boss, 300, 135, 2, noParticles), false);
  assert.equal(boss.weakPoints[0].destroyed, false);
});

test("arrivé, son dernier point faible détruit donne la victoire", () => {
  const boss = bossWithOneWeakPoint(true);
  assert.equal(hitBossWeakPoint(boss, 300, 135, 2, noParticles), true);
  assert.equal(boss.victory, true);
});
