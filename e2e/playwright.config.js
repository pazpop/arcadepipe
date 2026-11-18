// @ts-check
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  // `python -m http.server` (voir webServer ci-dessous) a une file d'attente
  // TCP courte et refuse des connexions sous charge concurrente — plusieurs
  // workers en parallèle déclenchent des ERR_CONNECTION_REFUSED aléatoires.
  // Un seul worker suffit largement pour la taille de cette suite.
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI, // un test.only oublié ferait passer la CI avec un seul test
  reporter: "list",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:5500",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // Français (langue de référence) : le jeu suit la langue du navigateur,
    // anglaise par défaut sous Playwright (voir i18n.spec.js pour l'anglais).
    locale: "fr-FR",
    // Panneau de réglages ouvert (il est replié par défaut) : la plupart des
    // tests y cliquent. mobile.spec.js vérifie l'état par défaut.
    storageState: {
      cookies: [],
      origins: [{ origin: "http://localhost:5500", localStorage: [{ name: "arcadepipe_panel_collapsed", value: "0" }] }],
    },
  },
  // Démarre/arrête automatiquement le serveur statique du frontend — pas besoin
  // de le lancer à la main avant de tester. stderr ignoré : ce serveur y écrit
  // une ligne par fichier servi, ce qui noierait le résultat des tests.
  webServer: {
    command: "python -m http.server 5500 --directory ../frontend",
    url: "http://localhost:5500",
    stderr: "ignore",
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
