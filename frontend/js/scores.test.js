// Tests du classement local (scores.js).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEYS } from "./config.js";
import { saveItem } from "./storage.js";
import { topScores, qualifies, addScore, recordGamePlayed, gamesPlayed, TOP_SIZE } from "./scores.js";

beforeEach(() => {
  saveItem(STORAGE_KEYS.scores, "[]");
  saveItem(STORAGE_KEYS.gamesPlayed, "0");
});

test("classement vide : tout score positif y entre, jamais zéro", () => {
  assert.deepEqual(topScores(), []);
  assert.equal(qualifies(1), true);
  assert.equal(qualifies(0), false);
});

test("les scores sont rangés du meilleur au moins bon, à égalité le premier arrivé devant", () => {
  addScore("BOB", 100, 1, 5);
  addScore("ANN", 300, 3, 20);
  addScore("CAT", 100, 2, 8);
  assert.deepEqual(
    topScores().map((s) => s.player_name),
    ["ANN", "BOB", "CAT"],
  );
  assert.deepEqual(topScores()[0], { player_name: "ANN", score: 300, wave: 3, kills: 20 });
});

test("le classement garde les TOP_SIZE meilleurs ; il faut battre le dernier pour y entrer", () => {
  for (let i = 1; i <= TOP_SIZE + 2; i++) addScore("AAA", i * 10, 1, 0);
  const top = topScores();
  assert.equal(top.length, TOP_SIZE);
  assert.equal(top.at(-1).score, 30);
  assert.equal(qualifies(30), false);
  assert.equal(qualifies(31), true);
});

test("une liste illisible donne un classement vide, sans erreur", () => {
  saveItem(STORAGE_KEYS.scores, "pas du json");
  assert.deepEqual(topScores(), []);
  saveItem(STORAGE_KEYS.scores, '{"score": 5}');
  assert.deepEqual(topScores(), []);
});

test("le compteur de parties jouées", () => {
  assert.equal(gamesPlayed(), 0);
  recordGamePlayed();
  recordGamePlayed();
  assert.equal(gamesPlayed(), 2);
});
