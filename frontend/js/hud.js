// Tout le texte/UI du jeu : HUD en partie, écrans menu/classement/crédits
// en partie (le petit canvas interne + `image-rendering: pixelated` suffit à
// donner un rendu de texte "façon bitmap" sans avoir à dessiner une police
// pixel par pixel).
import { RES_W, RES_H, PALETTE, POWERUP } from "./config.js";

// Point dans un rectangle {x,y,w,h} centré sur (x,y) — même test répété par
// toutes les fonctions hitTest* ci-dessous (menu, pause, confirmation,
// boutons uniques), factorisé ici plutôt que copié à chaque écran.
function pointInRect(x, y, r) {
  return x > r.x - r.w / 2 && x < r.x + r.w / 2 && y > r.y - r.h / 2 && y < r.y + r.h / 2;
}

// Index du rectangle survolé/cliqué parmi une liste (menu, pause,
// confirmation) ; -1 si aucun.
function hitTestRects(x, y, rects) {
  for (let i = 0; i < rects.length; i++) {
    if (pointInRect(x, y, rects[i])) return i;
  }
  return -1;
}

// Bouton unique (aide, game over, saisie du nom) : 0 si survolé/cliqué, -1
// sinon — même contrat que hitTestRects, pour rester compatible avec
// syncHover()/syncHoverWithSound() côté game.js.
function hitTestSingle(x, y, r) {
  return pointInRect(x, y, r) ? 0 : -1;
}

function text(ctx, str, x, y, { size = 8, color = PALETTE.hud, align = "left", alpha = 1, glow = null } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 4;
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// --- HUD en partie ---

export function drawGameHud(ctx, s, lives) {
  text(ctx, `SCORE ${s.score}`, 8, 10, { size: 8, align: "left" });
  // Compteur d'ennemis tués/objectif à côté du numéro de vague — seulement
  // hors vague de boss : là, la victoire vient de la coque, pas d'un total
  // de kills (voir waveDone dans game.js), l'afficher serait trompeur. Sur
  // la même ligne que "VAGUE" (pas une ligne à part) pour ne pas empiéter
  // sur l'indicateur de buff/bouclier juste en dessous.
  if (s.boss) {
    text(ctx, `VAGUE ${s.wave}`, RES_W / 2, 10, { size: 8, align: "center" });
  } else {
    const kills = String(Math.min(s.waveKills, s.waveKillTarget)).padStart(2, "0");
    const target = String(s.waveKillTarget).padStart(2, "0");
    text(ctx, `VAGUE ${s.wave}   ${kills}/${target}`, RES_W / 2, 10, { size: 8, align: "center" });
  }
  text(ctx, "♥".repeat(Math.max(0, lives)), RES_W - 8, 10, {
    size: 8,
    align: "right",
    color: PALETTE.enemyNormal,
    glow: PALETTE.enemyNormal,
  });
}

export function drawBuffIndicator(ctx, buff) {
  if (!buff) return;
  const def = POWERUP.types[buff.type];
  text(ctx, `${def.label} (${Math.ceil(buff.timer)}s) — ${def.effect}`, RES_W / 2, 20, {
    size: 7,
    align: "center",
    color: def.color,
    glow: def.color,
  });
}

// Ligne distincte du buff (arme) : le bouclier n'a pas de minuteur, juste un
// nombre de coups restants, et peut être actif en même temps qu'un buff.
export function drawShieldIndicator(ctx, hits) {
  if (!hits) return;
  const def = POWERUP.types.shield;
  text(ctx, `${def.label} x${hits}`, RES_W / 2, 30, {
    size: 7,
    align: "center",
    color: def.color,
    glow: def.color,
  });
}

export function drawBanner(ctx, banner) {
  if (!banner) return;
  text(ctx, banner.text, RES_W / 2, RES_H * 0.22, {
    size: 14,
    align: "center",
    color: PALETTE.enemyNormal,
    glow: PALETTE.enemyNormal,
    alpha: Math.min(1, banner.timer),
  });
}

export function drawControlHint(ctx, timer) {
  if (timer <= 0) return;
  text(ctx, "MAINTIENS CLIC / DOIGT POUR TIRER", RES_W / 2, RES_H - 16, {
    size: 7,
    align: "center",
    color: PALETTE.hud,
    alpha: Math.min(0.85, timer),
  });
}

export function drawFlash(ctx, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, amount);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, RES_W, RES_H);
  ctx.restore();
}

// --- Écran titre ---

const MENU_OPTIONS = ["JOUER", "CLASSEMENT", "AIDE", "CRÉDITS"];

export function menuOptionRects() {
  // Zones cliquables plus larges que le texte affiché : sur mobile, la
  // taille logique (480x270) est agrandie mais un doigt reste un doigt —
  // mieux vaut une marge généreuse qu'un bouton manqué.
  const startY = RES_H * 0.56;
  const gap = 22;
  return MENU_OPTIONS.map((label, i) => ({
    label,
    x: RES_W / 2,
    y: startY + i * gap,
    w: 220,
    h: 20,
  }));
}

export function hitTestMenu(x, y) {
  return hitTestRects(x, y, menuOptionRects());
}

// Bref résumé de l'histoire (survie de la galaxie face à une invasion) —
// affiché entre le titre et les options du menu, fixe (ne flotte pas avec
// le titre) pour ne jamais empiéter sur les options en dessous.
const LORE_LINES = [
  "La galaxie agonise sous les flottes ennemies —",
  "seul aux commandes du dernier chasseur libre,",
  "tu es son unique espoir de survie.",
];

export function drawTitleScreen(ctx, elapsed, selected) {
  ctx.save();
  const float = Math.sin(elapsed * 1.6) * 4;
  text(ctx, "ARCADEPIPE", RES_W / 2, RES_H * 0.26 + float, {
    size: 30,
    align: "center",
    color: PALETTE.bulletPlayer,
    glow: PALETTE.enemyElite,
  });
  text(ctx, "STARFIGHTER", RES_W / 2, RES_H * 0.26 + float + 20, {
    size: 12,
    align: "center",
    color: PALETTE.player,
    glow: PALETTE.player,
  });

  LORE_LINES.forEach((line, i) => {
    text(ctx, line, RES_W / 2, RES_H * 0.4 + i * 10, {
      size: 7,
      align: "center",
      alpha: 0.75,
    });
  });

  const rects = menuOptionRects();
  rects.forEach((r, i) => {
    const isSel = i === selected;
    text(ctx, (isSel ? "▶ " : "  ") + r.label, r.x, r.y, {
      size: 12,
      align: "center",
      color: isSel ? PALETTE.bulletPlayer : PALETTE.hud,
      glow: isSel ? PALETTE.bulletPlayer : null,
    });
  });

  const blink = Math.sin(elapsed * 4) > 0;
  if (blink) {
    text(ctx, "APPUIE SUR ENTRÉE / TOUCHE POUR COMMENCER", RES_W / 2, RES_H - 14, {
      size: 7,
      align: "center",
      color: PALETTE.hud,
      alpha: 0.8,
    });
  }
  ctx.restore();
}

// --- Écran classement ---

const MEDAL_COLORS = [PALETTE.gold, PALETTE.silver, PALETTE.bronze];

// Colonnes ancrées à des X fixes (rang/nom alignés à gauche, le reste à
// droite) plutôt qu'une seule chaîne centrée par ligne — sinon les tailles
// de police différentes des 3 premières places (médailles) désalignent tout
// le tableau par rapport aux autres lignes et à l'en-tête.
const COL = {
  rank: 20,
  name: 55,
  score: RES_W - 175,
  wave: RES_W - 105,
  kills: RES_W - 20,
};

export function drawLeaderboardScreen(ctx, scores, revealCount, gamesPlayed) {
  text(ctx, "CLASSEMENT", RES_W / 2, 24, { size: 16, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });
  // Masqué plutôt qu'un faux "0" si le backend est injoignable (voir
  // goToLeaderboard dans game.js, qui laisse gamesPlayed à null dans ce cas).
  if (gamesPlayed != null) {
    text(ctx, `${gamesPlayed} PARTIES JOUÉES`, RES_W / 2, 34, { size: 7, align: "center", alpha: 0.6 });
  }
  text(ctx, "RANG", COL.rank, 42, { size: 7, align: "left", alpha: 0.7 });
  text(ctx, "NOM", COL.name, 42, { size: 7, align: "left", alpha: 0.7 });
  text(ctx, "SCORE", COL.score, 42, { size: 7, align: "right", alpha: 0.7 });
  text(ctx, "VAGUE", COL.wave, 42, { size: 7, align: "right", alpha: 0.7 });
  text(ctx, "TUÉS", COL.kills, 42, { size: 7, align: "right", alpha: 0.7 });

  if (!scores || scores.length === 0) {
    text(ctx, "Aucun score pour l'instant.", RES_W / 2, RES_H / 2, { size: 9, align: "center" });
  }

  const rowH = 16;
  const startY = 58;
  scores.slice(0, revealCount).forEach((sc, i) => {
    const isMedal = i < 3;
    const color = isMedal ? MEDAL_COLORS[i] : PALETTE.hud;
    const size = isMedal ? 10 : 8;
    const y = startY + i * rowH;
    const rank = `${String(i + 1).padStart(2, "0")}.`;
    const name = (sc.player_name || "---").toUpperCase().slice(0, 8);
    const wave = sc.wave != null ? String(sc.wave) : "-";
    const kills = sc.kills != null ? String(sc.kills) : "-";
    const glow = isMedal ? color : null;
    text(ctx, rank, COL.rank, y, { size, align: "left", color, glow });
    text(ctx, name, COL.name, y, { size, align: "left", color, glow });
    text(ctx, String(sc.score), COL.score, y, { size, align: "right", color, glow });
    text(ctx, wave, COL.wave, y, { size, align: "right", color, glow });
    text(ctx, kills, COL.kills, y, { size, align: "right", color, glow });
  });

  text(ctx, "ÉCHAP / TAP — RETOUR", RES_W / 2, RES_H - 12, { size: 7, align: "center", alpha: 0.7 });
}

// --- Écran crédits ---

export const CREDITS_LINES = [
  "ARCADEPIPE",
  "STARFIGHTER",
  "v2.0",
  "",
  "UN JEU DÉVELOPPÉ PAR PAZPOP",
  "",
  "MUSIQUE",
  "KEYGEN MUSIC",
  "https://keygen.music",
  "MERCI À LA COMMUNAUTÉ DE PRÉSERVATION",
  "DE LA SCÈNE KEYGEN / DEMOSCENE",
  "DES ANNÉES 90-2000",
  "",
  "MERCI SPÉCIAL À CLAUDE (ANTHROPIC)",
  "POUR L'ASSISTANCE AU DÉVELOPPEMENT",
  "",
  "TECHNOLOGIES",
  "JAVASCRIPT · CANVAS 2D",
  "WEB AUDIO API · SQLITE",
  "",
  "MERCI D'AVOIR JOUÉ !",
];

export function drawCreditsScreen(ctx, scrollY) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, RES_W, RES_H);
  ctx.clip();
  const lineH = 16;
  CREDITS_LINES.forEach((line, i) => {
    const y = RES_H - scrollY + i * lineH;
    if (y < -lineH || y > RES_H + lineH) return;
    text(ctx, line, RES_W / 2, y, {
      size: i === 0 ? 14 : i === 1 ? 9 : 8,
      align: "center",
      color: i === 0 ? PALETTE.bulletPlayer : i === 1 ? PALETTE.player : PALETTE.hud,
      glow: i === 0 ? PALETTE.bulletPlayer : i === 1 ? PALETTE.player : null,
    });
  });
  ctx.restore();
}

// --- Pause ---

const PAUSE_OPTIONS = ["REPRENDRE", "AIDE", "MENU PRINCIPAL"];

export function pauseOptionRects() {
  const startY = RES_H * 0.4 + 24;
  const gap = 20;
  return PAUSE_OPTIONS.map((label, i) => ({
    label,
    x: RES_W / 2,
    y: startY + i * gap,
    w: 200,
    h: 18,
  }));
}

export function hitTestPause(x, y) {
  return hitTestRects(x, y, pauseOptionRects());
}

export function drawPauseScreen(ctx, selected) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, RES_W, RES_H);
  text(ctx, "PAUSE", RES_W / 2, RES_H * 0.4, { size: 18, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });
  pauseOptionRects().forEach((r, i) => {
    const isSel = i === selected;
    text(ctx, (isSel ? "▶ " : "  ") + r.label, r.x, r.y, {
      size: 11,
      align: "center",
      color: isSel ? PALETTE.bulletPlayer : PALETTE.hud,
      glow: isSel ? PALETTE.bulletPlayer : null,
    });
  });
  ctx.restore();
}

// --- Confirmation de sortie de partie (depuis la pause) ---

const CONFIRM_QUIT_OPTIONS = ["OUI, QUITTER", "NON, CONTINUER"];

export function confirmQuitOptionRects() {
  const startY = RES_H * 0.58;
  const gap = 20;
  return CONFIRM_QUIT_OPTIONS.map((label, i) => ({
    label,
    x: RES_W / 2,
    y: startY + i * gap,
    w: 200,
    h: 18,
  }));
}

export function hitTestConfirmQuit(x, y) {
  return hitTestRects(x, y, confirmQuitOptionRects());
}

export function drawConfirmQuitScreen(ctx, selected) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, RES_W, RES_H);
  text(ctx, "QUITTER LA PARTIE ?", RES_W / 2, RES_H * 0.38, {
    size: 14,
    align: "center",
    color: PALETTE.enemyNormal,
    glow: PALETTE.enemyNormal,
  });
  text(ctx, "TA PROGRESSION ACTUELLE SERA PERDUE.", RES_W / 2, RES_H * 0.38 + 18, {
    size: 8,
    align: "center",
    alpha: 0.85,
  });
  confirmQuitOptionRects().forEach((r, i) => {
    const isSel = i === selected;
    text(ctx, (isSel ? "▶ " : "  ") + r.label, r.x, r.y, {
      size: 11,
      align: "center",
      color: isSel ? PALETTE.bulletPlayer : PALETTE.hud,
      glow: isSel ? PALETTE.bulletPlayer : null,
    });
  });
  ctx.restore();
}

// --- Aides de jeu (première partie, premier boss) ---

export function infoContinueRect() {
  return { x: RES_W / 2, y: RES_H * 0.86, w: 200, h: 18 };
}

export function hitTestInfoContinue(x, y) {
  return hitTestSingle(x, y, infoContinueRect());
}

// Découpe une chaîne en lignes qui tiennent dans maxWidth pour la police
// courante du contexte (mesurée via measureText) — nécessaire pour le
// tableau à deux colonnes, où chaque colonne est deux fois plus étroite que
// l'écran complet.
function wrapLines(ctx, str, maxWidth) {
  const words = str.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(test).width > maxWidth) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Contenu organisé en catégories (titre + détail), réparties en deux
// colonnes façon tableau plutôt qu'une seule liste verticale — plus
// compact et plus facile à parcourir d'un coup d'œil sur un canevas de
// 270px de haut.
export function drawInfoScreen(ctx, content) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.9)";
  ctx.fillRect(0, 0, RES_W, RES_H);
  text(ctx, content.title, RES_W / 2, RES_H * 0.09, {
    size: 14,
    align: "center",
    color: PALETTE.bulletPlayer,
    glow: PALETTE.bulletPlayer,
  });

  const sections = content.sections;
  const half = Math.ceil(sections.length / 2);
  const columns = [sections.slice(0, half), sections.slice(half)];
  const colX = [RES_W * 0.27, RES_W * 0.73];
  const colWidth = RES_W * 0.42;
  const detailFont = "7px monospace";
  const startY = RES_H * 0.09 + 28;
  const lineH = 9;
  const sectionGap = 10;

  columns.forEach((items, c) => {
    let y = startY;
    ctx.font = detailFont; // pour measureText dans wrapLines ci-dessous
    for (const section of items) {
      text(ctx, section.heading, colX[c], y, {
        size: 9,
        align: "center",
        color: PALETTE.player,
        glow: PALETTE.player,
      });
      y += 12;
      const lines = wrapLines(ctx, section.detail, colWidth);
      for (const line of lines) {
        text(ctx, line, colX[c], y, { size: 7, align: "center" });
        y += lineH;
      }
      y += sectionGap;
    }
  });

  const r = infoContinueRect();
  text(ctx, "▶ CONTINUER", r.x, r.y, {
    size: 11,
    align: "center",
    color: PALETTE.bulletPlayer,
    glow: PALETTE.bulletPlayer,
  });
  ctx.restore();
}

// --- Game over / saisie du nom ---

export function drawGameOverScreen(ctx, score, wave, kills) {
  text(ctx, "GAME OVER", RES_W / 2, RES_H * 0.28, { size: 20, align: "center", color: PALETTE.enemyNormal, glow: PALETTE.enemyNormal });
  text(ctx, `SCORE ${score}  ·  VAGUE ${wave}  ·  ${kills} ENNEMIS`, RES_W / 2, RES_H * 0.28 + 22, { size: 10, align: "center" });
}

// --- Écran "GAME OVER" intermédiaire (après le ralenti de mort, avant la
// saisie du nom/le classement) ---

export function gameOverContinueRect() {
  return { x: RES_W / 2, y: RES_H * 0.62, w: 200, h: 18 };
}

export function hitTestGameOverContinue(x, y) {
  return hitTestSingle(x, y, gameOverContinueRect());
}

export function drawDeathScreen(ctx, score, wave, kills) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, RES_W, RES_H);
  drawGameOverScreen(ctx, score, wave, kills);
  const r = gameOverContinueRect();
  text(ctx, "▶ OK", r.x, r.y, {
    size: 12,
    align: "center",
    color: PALETTE.bulletPlayer,
    glow: PALETTE.bulletPlayer,
  });
  ctx.restore();
}

// Bouton tactile pour valider le nom — indispensable sur mobile : le
// clavier virtuel n'apparaît pas toujours (focus() hors du geste utilisateur
// d'origine, voir handleGameOver dans game.js), donc "ENTRÉE" seule au
// clavier physique ne suffit pas pour valider le nom pré-rempli aléatoire.
export function nameEntryValidateRect() {
  return { x: RES_W / 2, y: RES_H * 0.48 + 54, w: 200, h: 18 };
}

export function hitTestNameEntryValidate(x, y) {
  return hitTestSingle(x, y, nameEntryValidateRect());
}

export function drawNameEntry(ctx, name, cursorVisible) {
  text(ctx, "NOUVEAU MEILLEUR SCORE !", RES_W / 2, RES_H * 0.48, { size: 10, align: "center", color: PALETTE.bulletPlayer });
  text(ctx, "ENTRE TON NOM (8 CAR. MAX)", RES_W / 2, RES_H * 0.48 + 16, { size: 7, align: "center", alpha: 0.8 });
  const shown = name + (cursorVisible ? "_" : " ");
  text(ctx, shown.padEnd(8, "·"), RES_W / 2, RES_H * 0.48 + 34, { size: 14, align: "center", color: PALETTE.hud, glow: PALETTE.hud });
  const r = nameEntryValidateRect();
  text(ctx, "▶ VALIDER", r.x, r.y, { size: 11, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });
}
