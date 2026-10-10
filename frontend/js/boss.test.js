// Boss : points faibles (invulnérabilité à l'entrée, victoire), cadence, éventail, anneaux.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bossFanCount, bossFireInterval, bossPhase, hitBossWeakPoint, nextRingAngle, nextSpiralAngle, updateBoss } from "./boss.js";
import { BOSS } from "./config.js";
import { createProjectiles } from "./projectiles.js";

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

test("premier boss : ses éventails ont moins de tirs que ceux des suivants", () => {
  for (const destroyed of [0, 3]) {
    assert.ok(bossFanCount(destroyed, true) < bossFanCount(destroyed, false), `${destroyed} détruits`);
  }
});

test("anneaux : d'une salve à l'autre, les tirs ne repassent jamais par les mêmes rayons", () => {
  const count = 14;
  const gap = (Math.PI * 2) / count; // écart entre deux tirs d'un anneau
  const seen = new Set();
  let angle = 0;
  for (let volley = 0; volley < 30; volley++) {
    angle = nextRingAngle(angle, count);
    seen.add((angle % gap).toFixed(3));
  }
  assert.ok(seen.size >= 20, `${seen.size} positions distinctes sur 30 salves`);
});

// Tirs de la salve d'un boss intact (vague 10), `elapsed` secondes après son arrivée.
function volleySize(elapsed) {
  const weakPoints = Array.from({ length: 5 }, () => ({ destroyed: false, blink: 0 }));
  const boss = { wave: 10, arrived: true, victory: false, x: 400, y: 135, elapsed, fireTimer: 0, spiralAngle: 0, weakPoints };
  const projectiles = createProjectiles();
  updateBoss(boss, 1 / 60, projectiles, { x: 86, y: 135 });
  return projectiles.enemy.items.filter((b) => b.active).length;
}

test("boss qu'on n'attaque pas : le temps seul le fait passer de l'éventail à la spirale, puis à l'anneau", () => {
  const phase = BOSS.hurryEverySeconds;
  assert.equal(volleySize(0), 5); // éventail
  assert.equal(volleySize(phase + 1), 4); // spirale à 4 bras
  assert.equal(volleySize(phase * 2 + 1), 14); // anneau
});

test("spirale : en huit salves, ses tirs ne laissent aucun grand couloir intact", () => {
  for (const arms of [4, 6]) {
    const gap = (Math.PI * 2) / arms; // écart entre deux bras
    const seen = [];
    let angle = 0;
    for (let volley = 0; volley < 8; volley++) {
      angle = nextSpiralAngle(angle, arms);
      seen.push(angle % gap);
    }
    seen.sort((a, b) => a - b);
    let widest = seen[0] + gap - seen[7]; // le couloir à cheval sur deux bras
    for (let i = 1; i < 8; i++) widest = Math.max(widest, seen[i] - seen[i - 1]);
    assert.ok(widest < gap * 0.2, `${arms} bras : couloir de ${(widest / gap).toFixed(2)} écart`);
  }
});
