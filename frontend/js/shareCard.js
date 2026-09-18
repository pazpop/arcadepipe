// Carte de partage (image PNG) générée à la fin d'une partie — même palette/
// style que le jeu (voir Charte graphique, GAMEPLAY.md), mais sur un canvas à
// part, carré et en haute résolution : le canvas du jeu lui-même reste tout
// petit (RES_W/RES_H) et agrandi sans flou, pas adapté à une image partageable.
import { PALETTE, VERSION } from "./config.js";
import qrcodeFactory from "../lib/qrcode.js";

const SIZE = 1080; // carré, la taille attendue par Discord/X pour un aperçu propre
const SHARE_URL = "https://arcadepipe.pazpop.net";

function text(ctx, str, x, y, { size = 24, color = PALETTE.hud, align = "left", glow = null } = {}) {
  ctx.font = `${size}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.shadowBlur = glow ? size * 0.3 : 0;
  ctx.shadowColor = glow || "transparent";
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Décor discret, cohérent avec le fond du jeu (voir stars.js) mais statique
// (une image, pas une animation) — un semis de points fixe, positions
// tirées une fois par carte plutôt qu'un vrai champ d'étoiles réutilisé
// (inutile ici, pas de défilement à faire).
function drawBackdrop(ctx) {
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = PALETTE.star;
  for (let i = 0; i < 140; i++) {
    ctx.globalAlpha = 0.2 + Math.random() * 0.5;
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 2, 2);
  }
  ctx.globalAlpha = 1;
}

// QR code pointant directement vers le jeu — noir sur blanc et marge
// ("quiet zone") volontairement conservés tels quels (pas de couleurs
// stylisées façon jeu) : la scannabilité prime sur l'esthétique ici,
// un contraste réduit ferait échouer la lecture par un vrai téléphone.
// typeNumber=0 = taille auto (la plus petite qui contient l'URL), niveau de
// correction 'M' = compromis standard entre taille et tolérance aux dégâts.
function drawQrCode(ctx, x, y, size) {
  const qr = qrcodeFactory(0, "M");
  qr.addData(SHARE_URL);
  qr.make();
  const count = qr.getModuleCount();
  const margin = size * 0.08;
  // Math.ceil (pas la taille de cellule flottante brute) : évite les fines
  // lignes claires entre modules adjacents dues à l'anti-aliasing du canvas
  // — mais du coup le fond blanc est redimensionné sur cette même taille
  // arrondie (pas `size` telle quelle), sinon les derniers modules
  // déborderaient légèrement du fond blanc sur le décor sombre.
  const cell = Math.ceil((size - margin * 2) / count);
  const actualSize = cell * count + margin * 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, actualSize, actualSize);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(x + margin + c * cell, y + margin + r * cell, cell, cell);
    }
  }
  return actualSize;
}

// stats : { score, wave, kills, maxGrazeChain, distanceTraveled } — voir
// getRunSummary() dans game.js, seule source de vérité pour ces champs (pas
// dupliqué ici).
function drawShareCard(ctx, stats) {
  drawBackdrop(ctx);

  text(ctx, "ARCADEPIPE", SIZE / 2, 130, { size: 54, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });
  text(ctx, "STARFIGHTER", SIZE / 2, 185, { size: 22, align: "center", color: PALETTE.player, glow: PALETTE.player });

  text(ctx, "SCORE", SIZE / 2, 340, { size: 22, align: "center", color: PALETTE.hud });
  text(ctx, String(stats.score), SIZE / 2, 420, { size: 90, align: "center", color: PALETTE.gold, glow: PALETTE.gold });

  // Grille 2x2 (plutôt qu'une seule rangée de 3) depuis l'ajout de la
  // distance parcourue — 4 stats ne tenaient plus proprement sur une ligne.
  const colGap = SIZE * 0.28;
  const rows = [
    [
      { label: "VAGUE ATTEINTE", value: String(stats.wave) },
      { label: "ENNEMIS ABATTUS", value: String(stats.kills) },
    ],
    [
      { label: "MEILLEURE CHAÎNE\nDE FRÔLEMENTS", value: String(stats.maxGrazeChain) },
      { label: "ANNÉES-LUMIÈRE\nPARCOURUES", value: String(Math.round(stats.distanceTraveled)) },
    ],
  ];
  const rowYs = [540, 660];
  rows.forEach((cols, r) => {
    const statY = rowYs[r];
    cols.forEach((c, i) => {
      const x = SIZE / 2 + (i === 0 ? -1 : 1) * colGap;
      const labelLines = c.label.split("\n");
      labelLines.forEach((line, li) => {
        text(ctx, line, x, statY + li * 22, { size: 16, align: "center", color: PALETTE.hud });
      });
      text(ctx, c.value, x, statY + 60, { size: 36, align: "center", color: PALETTE.player, glow: PALETTE.player });
    });
  });

  text(ctx, "Tente de battre ce score :", SIZE / 2, 760, { size: 22, align: "center", color: PALETTE.hud });
  text(ctx, "arcadepipe.pazpop.net", SIZE / 2, 800, { size: 30, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });

  const qrSize = 200;
  drawQrCode(ctx, (SIZE - qrSize) / 2, 840, qrSize);

  text(ctx, `v${VERSION}`, SIZE - 20, SIZE - 18, { size: 14, align: "right", color: PALETTE.hud });
}

// Rendu direct dans un <canvas> hors-DOM — SIZE fixe, pas de paramètre :
// pensé pour être appelé juste avant un export (toBlob/toDataURL), pas
// affiché tel quel dans la page.
export function createShareCardCanvas(stats) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  drawShareCard(canvas.getContext("2d"), stats);
  return canvas;
}
