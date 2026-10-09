// Config minimale (eslint:recommended) — filet de sécurité, pas une
// transformation du style existant. Symétrique de ruff côté backend
// (voir backend/pyproject.toml).
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
        performance: "readonly",
        requestAnimationFrame: "readonly",
        Audio: "readonly",
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
        ClipboardItem: "readonly",
      },
    },
    rules: {
      // "warn" plutôt que "error" : un argument/import non utilisé pendant
      // une itération ne doit pas bloquer la CI, juste être visible.
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
