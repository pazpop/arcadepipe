// Points faibles du boss : invulnérabilité à l'entrée, victoire.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bossFanCount, bossFireInterval, bossPhase, hitBossWeakPoint } from "./boss.js";
import { BOSS } from "./config.js";

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

test("cadence du boss : l'intervalle raccourcit à chaque phase", () => {
  assert.equal(bossFireInterval(0, false), 1.2);
  for (let phase = 1; phase <= 5; phase++) {
    assert.ok(bossFireInterval(phase, false) < bossFireInterval(phase - 1, false));
  }
  assert.ok(Math.abs(bossFireInterval(5, false) - 0.134) < 0.005);
});

test("cadence du boss : le premier boss tire plus lentement", () => {
  assert.ok(bossFireInterval(2, true) > bossFireInterval(2, false));
});

test("éventail du boss : toujours un nombre impair de tirs, donc un tir au centre", () => {
  for (const firstBoss of [true, false]) {
    for (let destroyed = 0; destroyed <= 5; destroyed++) {
      assert.equal(bossFanCount(destroyed, firstBoss) % 2, 1, `${destroyed} détruits, premier boss : ${firstBoss}`);
    }
  }
});

test("phase du boss : monte avec les points faibles détruits et avec le temps, jusqu'à un plafond", () => {
  assert.equal(bossPhase(0, 0), 0);
  assert.equal(bossPhase(2, 0), 2);
  assert.equal(bossPhase(0, BOSS.hurryEverySeconds * 2 + 1), 2);
  assert.equal(bossPhase(2, BOSS.hurryEverySeconds + 1), 3);
  assert.equal(bossPhase(5, 10000), BOSS.weakPointsMax - 1);
});
