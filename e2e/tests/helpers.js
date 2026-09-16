// Utilitaires partagés : le canvas interne fait RES_W x RES_H (480x270,
// voir frontend/js/config.js) quelle que soit sa taille affichée — toutes
// les interactions doivent passer par ces conversions plutôt que des
// coordonnées écran en dur.
//
// Forcer temporairement une constante (taux de drop, difficulté...) pour un
// test : aucun point d'accès de debug n'est exposé côté app (rien à
// trouver/exploiter en prod). Les modules ES sont mis en cache par URL —
// un import dynamique déclenché depuis page.evaluate() récupère le même
// module déjà évalué par la page, pas une copie :
//
//   await page.evaluate(async () => {
//     const { DIFFICULTY } = await import("/js/config.js");
//     DIFFICULTY.baseWaveKills = 1;
//   });
export const RES_W = 480;
export const RES_H = 270;

export function canvasHelpers(page) {
  const canvas = page.locator("#game-canvas");

  async function toPage(logicalX, logicalY) {
    const box = await canvas.boundingBox();
    return {
      x: box.x + (logicalX / RES_W) * box.width,
      y: box.y + (logicalY / RES_H) * box.height,
    };
  }

  async function clickLogical(logicalX, logicalY) {
    const p = await toPage(logicalX, logicalY);
    await page.mouse.click(p.x, p.y);
  }

  async function moveLogical(logicalX, logicalY) {
    const p = await toPage(logicalX, logicalY);
    await page.mouse.move(p.x, p.y);
  }

  async function startRun() {
    await clickLogical(240, 150); // "JOUER" au menu
  }

  return { canvas, toPage, clickLogical, moveLogical, startRun };
}

// La plupart des tests veulent aller droit au gameplay — sans ça, l'aide de
// bienvenue (première partie) ou l'alerte boss (premier combat de boss)
// mettrait le jeu en pause automatiquement et fausserait silencieusement le
// test (pas d'erreur, mais rien de ce qui suit ne se produit vraiment).
// Un seul test dédié (menu-pause.spec.js) vérifie ces aides sans appeler ceci.
export async function skipHints(page) {
  await page.evaluate(() => localStorage.setItem("arcadepipe_seen_intro", "1"));
}

export function collectErrors(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
  return errors;
}
