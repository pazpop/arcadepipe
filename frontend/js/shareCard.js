// Carte de partage (image PNG) générée à la fin d'une partie : même palette
// que le jeu, sur un canvas à part, carré et en haute résolution.
import { PALETTE, VERSION } from "./config.js";
import { t } from "./i18n.js";
import qrcodeFactory from "../lib/qrcode.js";

const SIZE = 1080; // carré, la taille attendue par Discord/X pour un aperçu propre
const SHARE_HOST = "arcadepipe.pazpop.net";

function text(ctx, str, x, y, { size = 24, color = PALETTE.hud, align = "left", glow = null } = {}) {
  ctx.font = `${size}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.shadowBlur = glow ? size * 0.3 : 0;
  ctx.shadowColor = glow || "transparent";
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Fond sombre semé de points, comme le champ d'étoiles du jeu.
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

// QR code vers le jeu, centré sur centerX et large de maxSize au plus. Noir sur
// blanc avec sa marge : stylisé aux couleurs du jeu, un téléphone ne le lirait
// plus. typeNumber 0 = taille automatique, correction "M" = compromis standard
// entre taille et tolérance aux dégâts.
const QR_MARGIN_CELLS = 4; // marge blanche demandée par la norme, en modules

function drawQrCode(ctx, centerX, y, maxSize) {
  // Sans ombre : la lueur du texte précédent teinterait les modules du QR.
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  const qr = qrcodeFactory(0, "M");
  qr.addData(`https://${SHARE_HOST}`);
  qr.make();
  const count = qr.getModuleCount();
  // Cellules de taille entière (pas de fines lignes claires entre modules) ; le fond blanc suit.
  const cell = Math.floor(maxSize / (count + QR_MARGIN_CELLS * 2));
  const margin = cell * QR_MARGIN_CELLS;
  const size = cell * count + margin * 2;
  const x = centerX - size / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(x + margin + c * cell, y + margin + r * cell, cell, cell);
    }
  }
  ctx.restore();
}

// stats : le résumé de partie renvoyé par getRunSummary() (game.js).
function drawShareCard(ctx, stats) {
  drawBackdrop(ctx);

  text(ctx, "ARCADEPIPE", SIZE / 2, 130, { size: 54, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });
  text(ctx, "STARFIGHTER", SIZE / 2, 185, { size: 22, align: "center", color: PALETTE.player, glow: PALETTE.player });

  text(ctx, t("card.score"), SIZE / 2, 340, { size: 22, align: "center", color: PALETTE.hud });
  text(ctx, String(stats.score), SIZE / 2, 420, { size: 90, align: "center", color: PALETTE.gold, glow: PALETTE.gold });

  // Grille 2x2 : 4 stats ne tiennent pas proprement sur une ligne.
  const colGap = SIZE * 0.28;
  const rows = [
    [
      { label: t("card.wave"), value: String(stats.wave) },
      { label: t("card.kills"), value: String(stats.kills) },
    ],
    [
      { label: t("card.graze"), value: String(stats.maxGrazeChain) },
      { label: t("card.distance"), value: String(Math.round(stats.distanceTraveled)) },
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

  text(ctx, t("card.challenge"), SIZE / 2, 760, { size: 22, align: "center", color: PALETTE.hud });
  text(ctx, SHARE_HOST, SIZE / 2, 800, { size: 30, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });

  drawQrCode(ctx, SIZE / 2, 835, 225);

  text(ctx, `v${VERSION}`, SIZE - 20, SIZE - 18, { size: 14, align: "right", color: PALETTE.hud });
}

// Canvas hors de la page, destiné à l'export (toBlob).
export function createShareCardCanvas(stats) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  drawShareCard(canvas.getContext("2d"), stats);
  return canvas;
}
