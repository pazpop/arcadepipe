// Points faibles du boss : invulnérabilité à l'entrée, victoire.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bossFireInterval, hitBossWeakPoint } from "./boss.js";

// Un boss réduit à ce que lit hitBossWeakPoint : un seul point faible, à 1 PV, en son centre.
function bossWithOneWeakPoint(arrived) {
  return { arrived, x: 300, y: 135, victory: false, weakPoints: [{ ox: 0, oy: 0, hp: 1, destroyed: false }] };
}
const noParticles = { items: [] };

test("le boss est invulnérable tant qu'il n'est pas arrivé", () => {
  const boss = bossWithOneWeakPoint(false);
  assert.equal(hitBossWeakPoint(boss, 300, 135, 2, noParticles, 1), false);
  assert.equal(boss.weakPoints[0].destroyed, false);
});

test("arrivé, son dernier point faible détruit donne la victoire", () => {
  const boss = bossWithOneWeakPoint(true);
  assert.equal(hitBossWeakPoint(boss, 300, 135, 2, noParticles, 1), true);
  assert.equal(boss.victory, true);
});

test("cadence du boss : l'intervalle raccourcit à chaque point faible détruit", () => {
  assert.equal(bossFireInterval(0, false), 1.2);
  for (let destroyed = 1; destroyed <= 5; destroyed++) {
    assert.ok(bossFireInterval(destroyed, false) < bossFireInterval(destroyed - 1, false));
  }
  assert.ok(Math.abs(bossFireInterval(5, false) - 0.134) < 0.005);
});

test("cadence du boss : le premier boss tire plus lentement", () => {
  assert.ok(bossFireInterval(2, true) > bossFireInterval(2, false));
});
