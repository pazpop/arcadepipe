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
  reporter: "list",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:5500",
    screenshot: "only-on-failure",
  },
  // Démarre/arrête automatiquement le serveur statique du frontend (même
  // commande que la section "Lancer en local" du README) — pas besoin de le
  // lancer à la main avant de tester.
  webServer: {
    command: "python -m http.server 5500 --directory ../frontend",
    url: "http://localhost:5500",
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
