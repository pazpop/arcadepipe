// Tests pour les traductions (i18n.js, i18n/*.js) : chaque langue doit avoir
// exactement les clés et les {paramètres} du français, la langue de référence.
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { LANGS, lang, t } from "./i18n.js";

const params = (str) => (str.match(/\{\w+\}/g) || []).sort();

for (const [code, strings] of Object.entries(LANGS)) {
  if (code === "fr") continue; // la référence
  test(`${code} : mêmes clés que fr`, () => {
    assert.deepEqual(Object.keys(strings).sort(), Object.keys(LANGS.fr).sort());
  });

  test(`${code} : mêmes {paramètres} et mêmes retours à la ligne que fr`, () => {
    for (const [key, ref] of Object.entries(LANGS.fr)) {
      assert.deepEqual(params(strings[key] ?? ""), params(ref), key);
      assert.equal((strings[key] ?? "").split("\n").length, ref.split("\n").length, key);
    }
  });
}

test("t() remplace les {paramètres} et retombe sur la clé si elle est inconnue", () => {
  assert.equal(t("hud.score", { score: 42 }), LANGS[lang]["hud.score"].replace("{score}", "42"));
  assert.equal(t("cle.inconnue"), "cle.inconnue");
});
