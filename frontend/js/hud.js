// Tout le texte/UI du jeu — le petit canvas interne + `image-rendering:
// pixelated` suffit à un rendu "façon bitmap" sans dessiner une police pixel par pixel.
import { RES_W, RES_H, PALETTE, POWERUP, NOVA, BONUS_LEVEL, VERSION } from "./config.js";
import { drawPowerupIcon } from "./powerups.js";
import { bossHealthFraction } from "./boss.js";
import { buildSprites, drawWithGlow } from "./assets.js";

// Version courte de POWERUP.types[type].effect pour la légende de l'écran
// Aide — le texte complet (utilisé par drawBuffIndicator en jeu) est trop
// long pour tenir sur une ligne à cette résolution.
const BONUS_SHORT_EFFECT = {
  power: "dégâts renforcés, tir plus lent",
  rapid: "tir très rapide, dégâts réduits",
  shotgun: "cône de plombs, portée courte",
  shield: "absorbe des coups",
};

// Légende des ennemis (menu Aide, colonne droite) — boss volontairement
// exclu (sa propre section "BOSS" plus haut suffit, ses patterns changent en
// combat, et il n'a plus vraiment de "PV" au sens d'un ennemi normal). Sprite
// réel (assets.js) + même couleur que enemyGlowColor (enemies.js), pas une
// réinterprétation. PV recopiés à la main depuis TYPE_STATS/GUNNER_HP_BONUS
// (enemies.js) — pas de pastilles en jeu depuis leur retrait, donc c'est ici
// leur seule indication visible pour le joueur.
const ENEMY_LEGEND = [
  { spriteKey: "enemyNormal", color: PALETTE.enemyNormal, text: "FACILE — 1 PV, pas de tir, ligne droite" },
  { spriteKey: "enemyGunner", color: PALETTE.enemyGunner, text: "MOYEN — 2 PV, tire visé (vague 5+)" },
  { spriteKey: "enemyElite", color: PALETTE.enemyElite, text: "ÉLITE — 3 PV, tire visé, ondule" },
  { spriteKey: "enemyKamikaze", color: PALETTE.danger, text: "KAMIKAZE — 1 PV, fonce sur toi (vague 4+)" },
];

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
// syncHover()/syncHoverWithSound() côté states/navHelpers.js.
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

// Rectangles cliquables d'une liste verticale d'options centrée (menu
// principal, pause, confirmation de sortie) — même géométrie répétée à
// chaque écran, seuls startY/gap/w/h changent d'un écran à l'autre.
function verticalOptionRects(options, startY, gap, w, h) {
  return options.map((label, i) => ({ label, x: RES_W / 2, y: startY + i * gap, w, h }));
}

// Dessine cette même liste avec le curseur "▶" sur l'option survolée/sélectionnée.
function drawOptionList(ctx, rects, selected, size = 11) {
  rects.forEach((r, i) => {
    const isSel = i === selected;
    text(ctx, (isSel ? "▶ " : "  ") + r.label, r.x, r.y, {
      size,
      align: "center",
      color: isSel ? PALETTE.bulletPlayer : PALETTE.hud,
      glow: isSel ? PALETTE.bulletPlayer : null,
    });
  });
}

// --- HUD en partie ---

export function drawGameHud(ctx, s, lives) {
  text(ctx, `SCORE ${s.score}`, 8, 10, { size: 8, align: "left" });
  // Compteur de kills/objectif à côté de la vague — masqué en vague de boss
  // (victoire = coque, pas un total de kills). Même ligne que "VAGUE" pour
  // ne pas empiéter sur l'indicateur de buff/bouclier.
  if (s.bonusLevel) {
    text(ctx, `NIVEAU BONUS — ANNEAUX ${s.bonusLevel.passedCount}/${BONUS_LEVEL.ringCount}`, RES_W / 2, 10, {
      size: 8,
      align: "center",
      color: NOVA.color,
    });
  } else if (s.boss) {
    text(ctx, `VAGUE ${s.wave}`, RES_W / 2, 10, { size: 8, align: "center" });
  } else {
    const kills = String(Math.min(s.waveKills, s.waveKillTarget)).padStart(2, "0");
    const target = String(s.waveKillTarget).padStart(2, "0");
    text(ctx, `VAGUE ${s.wave}   ${kills}/${target}`, RES_W / 2, 10, { size: 8, align: "center" });
  }
  text(ctx, "♥".repeat(Math.max(0, lives)), RES_W - 8, 10, {
    size: 8,
    align: "right",
    color: PALETTE.danger,
    glow: PALETTE.danger,
  });
}

// Jauge NOVA : charges dispo / max (ex. "NOVA 1/2" — le max lui-même monte
// à 2 après le 2e combat de boss, voir novaMaxForWave dans graze.js, d'où
// l'intérêt de toujours l'afficher plutôt qu'un simple compteur) + une fine
// barre de progression vers la prochaine charge — en haut à gauche, sous le
// score, symétrique des vies (haut à droite). Jaune pâle à 0 charge, jaune
// vif (avec glow) dès qu'au moins une est prête à être utilisée.
export function drawNovaGauge(ctx, stock, max, progress) {
  if (max <= 0) return;
  const color = NOVA.color;
  const y = 20;
  text(ctx, `NOVA ${stock}/${max}`, 8, y, {
    size: 7,
    align: "left",
    color,
    glow: stock > 0 ? color : null,
    alpha: stock > 0 ? 1 : 0.6,
  });
  if (stock < max) {
    const barW = 36;
    const barH = 2;
    const barX = 8;
    const barY = y + 6;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW * progress, barH);
    ctx.restore();
  }
}

// Barre de vie du boss : pleine largeur, fixe tout en bas de l'écran plutôt
// qu'accrochée à sa position (petite, se déplaçait avec lui) — convention
// classique de combat de boss, plus facile à surveiller du coin de l'œil
// pendant qu'on esquive. Rouge — distinct du jaune/or de sa coque et de ses
// points faibles (PALETTE.boss/bossWeakOn), jamais réutilisé ailleurs.
export function drawBossHealthBar(ctx, boss) {
  if (!boss || boss.victory) return;
  const frac = bossHealthFraction(boss);
  const margin = 6;
  const h = 5;
  const barY = RES_H - h - 4;
  const barW = RES_W - margin * 2;
  ctx.save();
  ctx.fillStyle = "#2a0a10";
  ctx.fillRect(margin, barY, barW, h);
  ctx.fillStyle = PALETTE.danger;
  ctx.shadowColor = PALETTE.danger;
  ctx.shadowBlur = 4;
  ctx.fillRect(margin, barY, barW * frac, h);
  ctx.restore();
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

// Ligne distincte du buff : le bouclier n'a pas de minuteur (juste des coups restants), peut être actif en même temps.
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
    color: PALETTE.danger,
    glow: PALETTE.danger,
    alpha: Math.min(1, banner.timer),
  });
}

// Message d'intro du niveau bonus (voir BONUS_LEVEL.introDuration dans
// config.js) — pendant que le vaisseau glisse depuis la gauche, avant que le
// premier anneau n'apparaisse. Fondu de sortie dans les 0.6 dernières
// secondes plutôt qu'une coupure nette.
export function drawBonusLevelIntro(ctx, timer) {
  const alpha = Math.min(1, timer / 0.6);
  text(ctx, "NIVEAU BONUS DÉBLOQUÉ !", RES_W / 2, RES_H * 0.3, {
    size: 13,
    align: "center",
    color: PALETTE.gold,
    glow: PALETTE.gold,
    alpha,
  });
  text(ctx, "Score suffisant atteint pour le découvrir", RES_W / 2, RES_H * 0.3 + 18, {
    size: 8,
    align: "center",
    alpha: alpha * 0.85,
  });
  text(ctx, "Traverse les anneaux pour charger ta jauge NOVA !", RES_W / 2, RES_H * 0.3 + 32, {
    size: 8,
    align: "center",
    color: NOVA.color,
    glow: NOVA.color,
    alpha,
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

// Zones cliquables plus larges que le texte — sur mobile, mieux vaut une marge généreuse qu'un bouton manqué.
function menuOptionRects() {
  return verticalOptionRects(MENU_OPTIONS, RES_H * 0.56, 22, 220, 20);
}

export function hitTestMenu(x, y) {
  return hitTestRects(x, y, menuOptionRects());
}

// Résumé de l'histoire, entre le titre et les options — fixe (ne flotte pas
// avec le titre) pour ne jamais empiéter dessous.
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

  drawOptionList(ctx, menuOptionRects(), selected, 12);
  ctx.restore();
}

// --- Écran classement ---

const MEDAL_COLORS = [PALETTE.gold, PALETTE.silver, PALETTE.bronze];

// Colonnes ancrées à des X fixes (pas une chaîne centrée) — sinon les
// tailles de police différentes des médailles désaligneraient le tableau.
const COL = {
  rank: 20,
  name: 55,
  score: RES_W - 175,
  wave: RES_W - 105,
  kills: RES_W - 20,
};

export function drawLeaderboardScreen(ctx, scores, revealCount, gamesPlayed) {
  text(ctx, "CLASSEMENT", RES_W / 2, 24, { size: 16, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });
  // Masqué plutôt qu'un faux "0" si le backend est injoignable (goToLeaderboard laisse gamesPlayed à null).
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
  `v${VERSION}`,
  "",
  "UN JEU DÉVELOPPÉ PAR PAZPOP",
  "",
  "CODE SOURCE",
  "github.com/pazpop/arcadepipe",
  "",
  "MUSIQUE",
  "KEYGEN MUSIC",
  "https://keygen.music",
  "MERCI À LA COMMUNAUTÉ DE PRÉSERVATION",
  "DE LA SCÈNE KEYGEN / DEMOSCENE",
  "DES ANNÉES 90-2000",
  "",
  "MERCI SPÉCIAL À CLAUDE (ANTHROPIC)",
  "ET LUMO (PROTON)",
  "POUR L'ASSISTANCE AU DÉVELOPPEMENT",
  "",
  "TECHNOLOGIES",
  "JAVASCRIPT · CANVAS 2D",
  "WEB AUDIO API · SQLITE",
  "",
  "QR CODE : KAZUHIKO ARASE",
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

function pauseOptionRects() {
  return verticalOptionRects(PAUSE_OPTIONS, RES_H * 0.4 + 24, 20, 200, 18);
}

export function hitTestPause(x, y) {
  return hitTestRects(x, y, pauseOptionRects());
}

export function drawPauseScreen(ctx, selected) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, RES_W, RES_H);
  text(ctx, "PAUSE", RES_W / 2, RES_H * 0.4, { size: 18, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });
  drawOptionList(ctx, pauseOptionRects(), selected);
  ctx.restore();
}

// --- Confirmation de sortie de partie (depuis la pause) ---

const CONFIRM_QUIT_OPTIONS = ["OUI, QUITTER", "NON, CONTINUER"];

function confirmQuitOptionRects() {
  return verticalOptionRects(CONFIRM_QUIT_OPTIONS, RES_H * 0.58, 20, 200, 18);
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
    color: PALETTE.danger,
    glow: PALETTE.danger,
  });
  text(ctx, "TA PROGRESSION ACTUELLE SERA PERDUE.", RES_W / 2, RES_H * 0.38 + 18, {
    size: 8,
    align: "center",
    alpha: 0.85,
  });
  drawOptionList(ctx, confirmQuitOptionRects(), selected);
  ctx.restore();
}

// --- Aides de jeu (première partie, premier boss) ---

export function infoContinueRect() {
  return { x: RES_W / 2, y: RES_H * 0.86, w: 200, h: 18 };
}

export function hitTestInfoContinue(x, y) {
  return hitTestSingle(x, y, infoContinueRect());
}

// Pagination (voir states/help.js, HELP_PAGES) — juste au-dessus de
// CONTINUER, jamais chevauchée quel que soit le contenu de la page.
export function infoPrevRect() {
  return { x: RES_W * 0.32, y: RES_H * 0.78, w: 70, h: 16 };
}

export function infoNextRect() {
  return { x: RES_W * 0.68, y: RES_H * 0.78, w: 70, h: 16 };
}

export function hitTestInfoPrev(x, y) {
  return hitTestSingle(x, y, infoPrevRect());
}

export function hitTestInfoNext(x, y) {
  return hitTestSingle(x, y, infoNextRect());
}

// Découpe une chaîne en lignes qui tiennent dans maxWidth (measureText) —
// nécessaire pour les colonnes, deux fois plus étroites que l'écran.
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

// Contenu en catégories, réparties en deux colonnes (pas une liste
// verticale) — plus compact sur un canevas de 270px de haut. page/pageCount :
// pagination (voir states/help.js) — l'Aide était devenue trop chargée sur
// un seul écran une fois la section NOVA + la légende bonus/ennemis ajoutées.
export function drawInfoScreen(ctx, content, page = 0, pageCount = 1) {
  ctx.save();
  // Pas de fond opaque ici : le champ d'étoiles (dessiné par game.js avant
  // cet appel) doit rester visible, comme sur les autres écrans-menus.
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

  // Le bas de la colonne la plus haute dicte legendY ci-dessous : le nombre
  // de sections/lignes wrappées varie selon leur contenu (voir HELP_INFO
  // dans states/help.js), donc une valeur fixe se fait dépasser dès qu'une section
  // s'allonge — vécu une première fois en ajoutant la section NOVA.
  let tallestColBottom = startY;
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
    tallestColBottom = Math.max(tallestColBottom, y);
  });

  // Légende bonus + ennemis (menu Aide uniquement), deux colonnes côte à
  // côte (même x que les sections du haut) faute de hauteur pour les empiler.
  // Icônes identiques à ce qui apparaît en jeu (drawPowerupIcon partagé avec
  // powerups.js ; sprite réel d'assets.js pour les ennemis) — le joueur
  // associe l'apparence à l'effet sans avoir à le vérifier en jeu.
  if (content.showBonusLegend) {
    const legendY = tallestColBottom - sectionGap + 4;
    const rowH = 14;
    text(ctx, "BONUS", colX[0], legendY, { size: 9, align: "center", color: PALETTE.player, glow: PALETTE.player });
    const bonusIconX = colX[0] - 62;
    const bonusLabelX = bonusIconX + 10;
    Object.keys(POWERUP.types).forEach((type, i) => {
      const y = legendY + 16 + i * rowH;
      const def = POWERUP.types[type];
      drawPowerupIcon(ctx, bonusIconX, y, type, 4);
      text(ctx, `${def.label} — ${BONUS_SHORT_EFFECT[type]}`, bonusLabelX, y, { size: 6.5, align: "left", color: def.color });
    });

    text(ctx, "ENNEMIS", colX[1], legendY, { size: 9, align: "center", color: PALETTE.player, glow: PALETTE.player });
    const enemySprites = buildSprites();
    const enemyIconX = colX[1] - 62;
    const enemyLabelX = enemyIconX + 12;
    ENEMY_LEGEND.forEach((en, i) => {
      const y = legendY + 16 + i * rowH;
      drawWithGlow(ctx, enemySprites[en.spriteKey], enemyIconX, y, en.color, 0.3);
      text(ctx, en.text, enemyLabelX, y, { size: 6.5, align: "left", color: en.color });
    });
  }

  if (pageCount > 1) {
    const prevR = infoPrevRect();
    const nextR = infoNextRect();
    // Grisée plutôt que masquée aux extrémités : la position du bouton reste
    // stable, seule son opacité indique qu'il n'y a rien de plus dans ce sens.
    text(ctx, "◀ PRÉC.", prevR.x, prevR.y, { size: 9, align: "center", alpha: page > 0 ? 1 : 0.3 });
    text(ctx, `${page + 1}/${pageCount}`, RES_W / 2, prevR.y, { size: 9, align: "center", color: PALETTE.hud });
    text(ctx, "SUIV. ▶", nextR.x, nextR.y, { size: 9, align: "center", alpha: page < pageCount - 1 ? 1 : 0.3 });
  }

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

export function drawGameOverScreen(ctx, score, wave, kills, distance) {
  text(ctx, "GAME OVER", RES_W / 2, RES_H * 0.28, { size: 20, align: "center", color: PALETTE.danger, glow: PALETTE.danger });
  text(ctx, `SCORE ${score}  ·  VAGUE ${wave}  ·  ${kills} ENNEMIS`, RES_W / 2, RES_H * 0.28 + 22, { size: 10, align: "center" });
  text(ctx, `${Math.round(distance)} ANNÉES-LUMIÈRE PARCOURUES`, RES_W / 2, RES_H * 0.28 + 34, { size: 7, align: "center", alpha: 0.8 });
}

// --- Écran "GAME OVER" intermédiaire (après le ralenti de mort, avant la
// saisie du nom/le classement) ---

export function gameOverContinueRect() {
  return { x: RES_W / 2, y: RES_H * 0.62, w: 200, h: 18 };
}

export function hitTestGameOverContinue(x, y) {
  return hitTestSingle(x, y, gameOverContinueRect());
}

export function drawDeathScreen(ctx, score, wave, kills, distance) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, RES_W, RES_H);
  drawGameOverScreen(ctx, score, wave, kills, distance);
  const r = gameOverContinueRect();
  text(ctx, "▶ OK", r.x, r.y, {
    size: 12,
    align: "center",
    color: PALETTE.bulletPlayer,
    glow: PALETTE.bulletPlayer,
  });
  ctx.restore();
}

// Bouton tactile pour valider le nom — indispensable sur mobile où le
// clavier virtuel n'apparaît pas toujours (triggerGameOver dans states/endOfRun.js).
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
