// Config minimale (eslint:recommended) — filet de sécurité, pas une
// transformation du style existant. Symétrique de ruff côté backend
// (voir backend/pyproject.toml), le frontend étant devenu le plus gros
// morceau du repo sans aucune analyse statique jusqu'ici.
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    ignores: ["js/**/*.test.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        console: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
        Event: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
      },
    },
    rules: {
      // "warn" plutôt que "error" : un argument/import non utilisé pendant
      // une itération ne doit pas bloquer un build, juste être visible.
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Fichiers de test : exécutés sous Node (node --test), pas dans le
    // navigateur — pas les mêmes globales que le reste du frontend.
    files: ["js/**/*.test.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
];
