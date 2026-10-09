// Tout le texte/UI du jeu, en coordonnées logiques RES_W x RES_H. Le canvas
// est rendu à la résolution de l'écran (voir renderer.js), donc
// le texte reste net quelle que soit sa taille.
import { RES_W, RES_H, PALETTE, POWERUP, NOVA, BONUS_LEVEL, DIFFICULTY, VERSION } from "./config.js";
import { drawPowerupIcon } from "./powerups.js";
import { bossHealthFraction } from "./boss.js";
import { t } from "./i18n.js";
import { buildSprites, drawWithGlow } from "./assets.js";

// Légende des ennemis (écran Aide) — boss exclu (il a sa propre section).
// Sprite réel (assets.js) + même couleur que enemyGlowColor (enemies.js). PV
// recopiés à la main depuis TYPE_STATS/GUNNER_HP_BONUS (enemies.js), dans les
// fichiers de langue (i18n/) : c'est la seule indication de PV visible par le joueur.
const ENEMY_LEGEND = [
  { spriteKey: "enemyNormal", color: PALETTE.enemyNormal, text: t("enemy.normal") },
  { spriteKey: "enemyGunner", color: PALETTE.enemyGunner, text: t("enemy.gunner") },
  { spriteKey: "enemyElite", color: PALETTE.enemyElite, text: t("enemy.elite") },
  { spriteKey: "enemyKamikaze", color: PALETTE.danger, text: t("enemy.kamikaze") },
];

// Point dans un rectangle {x,y,w,h} centré sur (x,y).
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

// Rectangles cliquables d'une liste verticale d'options centrée (menu, pause, game over...).
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
  text(ctx, t("hud.score", { score: s.score }), 8, 10, { size: 8, align: "left" });
  // Compteur de kills/objectif à côté de la vague — masqué en vague de boss
  // (on le bat par ses points faibles, pas par un total de kills). Même ligne
  // que "VAGUE" pour ne pas empiéter sur l'indicateur de buff/bouclier.
  if (s.bonusLevel) {
    text(ctx, t("hud.bonusLevel", { passed: s.bonusLevel.passedCount, total: BONUS_LEVEL.ringCount }), RES_W / 2, 10, {
      size: 8,
      align: "center",
      color: NOVA.color,
    });
  } else if (s.boss) {
    text(ctx, t("hud.wave", { wave: s.wave }), RES_W / 2, 10, { size: 8, align: "center" });
  } else {
    const kills = String(Math.min(s.waveKills, s.waveKillTarget)).padStart(2, "0");
    const target = String(s.waveKillTarget).padStart(2, "0");
    text(ctx, `${t("hud.wave", { wave: s.wave })}   ${kills}/${target}`, RES_W / 2, 10, { size: 8, align: "center" });
  }
  text(ctx, "♥".repeat(Math.max(0, lives)), RES_W - 8, 10, {
    size: 8,
    align: "right",
    color: PALETTE.danger,
    glow: PALETTE.danger,
  });
  // Rappel du bonus "sans dégâts", sous les vies : affiché tant que la vague
  // est intacte, clignote en rouge 1 s au premier coup encaissé (s.intactBlink).
  const lost = s.tookDamageThisWave;
  if (!s.bonusLevel && (!lost || Math.floor(s.intactBlink * 8) % 2 === 1)) {
    text(ctx, t("hud.intact", { bonus: DIFFICULTY.noDamageWaveBonus }), RES_W - 8, 20, {
      size: 7,
      align: "right",
      color: lost ? PALETTE.danger : PALETTE.bulletPlayer,
      alpha: 0.85,
    });
  }
}

// Jauge NOVA, sous le score : charges disponibles / maximum ("NOVA 1/2", le
// maximum monte en cours de partie, voir novaMaxForWave dans graze.js) et une
// fine barre de progression vers la prochaine charge. Pâle sans charge, vive dès qu'une est prête.
export function drawNovaGauge(ctx, stock, max, progress) {
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

// Barre de vie du boss : pleine largeur, fixe en bas de l'écran (convention
// classique, facile à surveiller du coin de l'œil en esquivant). Rouge
// (PALETTE.danger), distinct du jaune/or de sa coque et de ses points faibles.
export function drawBossHealthBar(ctx, boss) {
  if (boss.victory) return;
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
  text(ctx, `${t(`powerup.${buff.type}`)} (${Math.ceil(buff.timer)}s) — ${t(`powerup.${buff.type}.effect`)}`, RES_W / 2, 20, {
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
  text(ctx, `${t("powerup.shield")} x${hits}`, RES_W / 2, 30, {
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
  text(ctx, t("bonus.intro.title"), RES_W / 2, RES_H * 0.3, {
    size: 13,
    align: "center",
    color: PALETTE.gold,
    glow: PALETTE.gold,
    alpha,
  });
  text(ctx, t("bonus.intro.line"), RES_W / 2, RES_H * 0.3 + 20, {
    size: 8,
    align: "center",
    color: NOVA.color,
    glow: NOVA.color,
    alpha,
  });
}

export function drawControlHint(ctx, timer) {
  if (timer <= 0) return;
  text(ctx, t("hud.controlHint"), RES_W / 2, RES_H - 16, {
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

export const MENU_OPTIONS = [t("menu.play"), t("menu.leaderboard"), t("menu.help"), t("menu.credits")];

// Zones cliquables plus larges que le texte — sur mobile, mieux vaut une marge généreuse qu'un bouton manqué.
function menuOptionRects() {
  return verticalOptionRects(MENU_OPTIONS, RES_H * 0.56, 22, 220, 20);
}

export function hitTestMenu(x, y) {
  return hitTestRects(x, y, menuOptionRects());
}

// Résumé de l'histoire, entre le titre et les options — fixe (ne flotte pas
// avec le titre) pour ne jamais empiéter dessous.
const LORE_LINES = t("menu.lore").split("\n");

export function drawTitleScreen(ctx, elapsed, selected) {
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

// scores : null pendant le chargement, ou si le backend est injoignable (failed).
export function drawLeaderboardScreen(ctx, scores, failed, revealCount, gamesPlayed) {
  text(ctx, t("menu.leaderboard"), RES_W / 2, 24, { size: 16, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });
  // Masqué plutôt qu'un faux "0" si le backend est injoignable.
  if (gamesPlayed != null) {
    text(ctx, t("board.games", { count: gamesPlayed }), RES_W / 2, 34, { size: 7, align: "center", alpha: 0.6 });
  }
  text(ctx, t("board.rank"), COL.rank, 42, { size: 7, align: "left", alpha: 0.7 });
  text(ctx, t("board.name"), COL.name, 42, { size: 7, align: "left", alpha: 0.7 });
  text(ctx, t("board.score"), COL.score, 42, { size: 7, align: "right", alpha: 0.7 });
  text(ctx, t("board.wave"), COL.wave, 42, { size: 7, align: "right", alpha: 0.7 });
  text(ctx, t("board.kills"), COL.kills, 42, { size: 7, align: "right", alpha: 0.7 });

  if (failed) text(ctx, t("board.error"), RES_W / 2, RES_H / 2, { size: 9, align: "center" });
  else if (scores && scores.length === 0) text(ctx, t("board.empty"), RES_W / 2, RES_H / 2, { size: 9, align: "center" });

  const rowH = 16;
  const startY = 58;
  (scores || []).slice(0, revealCount).forEach((sc, i) => {
    const isMedal = i < 3;
    const color = isMedal ? MEDAL_COLORS[i] : PALETTE.hud;
    const size = isMedal ? 10 : 8;
    const y = startY + i * rowH;
    const rank = `${String(i + 1).padStart(2, "0")}.`;
    const glow = isMedal ? color : null;
    text(ctx, rank, COL.rank, y, { size, align: "left", color, glow });
    text(ctx, sc.player_name, COL.name, y, { size, align: "left", color, glow });
    text(ctx, String(sc.score), COL.score, y, { size, align: "right", color, glow });
    text(ctx, String(sc.wave), COL.wave, y, { size, align: "right", color, glow });
    text(ctx, String(sc.kills), COL.kills, y, { size, align: "right", color, glow });
  });

  text(ctx, t("board.back"), RES_W / 2, RES_H - 12, { size: 7, align: "center", alpha: 0.7 });
}

// --- Écran crédits ---

export const CREDITS_LINE_HEIGHT = 16;

export const CREDITS_LINES = [
  "ARCADEPIPE",
  "STARFIGHTER",
  `v${VERSION}`,
  "",
  t("credits.by"),
  "",
  t("credits.source"),
  "github.com/pazpop/arcadepipe",
  "",
  t("credits.music"),
  "MALL-E",
  "mall-e.bandcamp.com",
  "",
  t("credits.thanks"),
  t("credits.thanks.music"),
  ...t("credits.thanks.ai").split("\n"),
  "",
  t("credits.tech"),
  "JAVASCRIPT · CANVAS 2D",
  "WEB AUDIO API · SQLITE",
  "",
  t("credits.qr"),
  "",
  t("credits.end"),
];

export function drawCreditsScreen(ctx, scrollY) {
  CREDITS_LINES.forEach((line, i) => {
    const y = RES_H - scrollY + i * CREDITS_LINE_HEIGHT;
    if (y < -CREDITS_LINE_HEIGHT || y > RES_H + CREDITS_LINE_HEIGHT) return;
    text(ctx, line, RES_W / 2, y, {
      size: i === 0 ? 14 : i === 1 ? 9 : 8,
      align: "center",
      color: i === 0 ? PALETTE.bulletPlayer : i === 1 ? PALETTE.player : PALETTE.hud,
      glow: i === 0 ? PALETTE.bulletPlayer : i === 1 ? PALETTE.player : null,
    });
  });
}

// --- Pause ---

export const PAUSE_OPTIONS = [t("pause.resume"), t("menu.help"), t("pause.menu")];

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
  text(ctx, t("pause.title"), RES_W / 2, RES_H * 0.4, { size: 18, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });
  drawOptionList(ctx, pauseOptionRects(), selected);
  ctx.restore();
}

// --- Confirmation de sortie de partie (depuis la pause) ---

const CONFIRM_QUIT_OPTIONS = [t("quit.yes"), t("quit.no")];

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
  text(ctx, t("quit.title"), RES_W / 2, RES_H * 0.38, {
    size: 14,
    align: "center",
    color: PALETTE.danger,
    glow: PALETTE.danger,
  });
  text(ctx, t("quit.warning"), RES_W / 2, RES_H * 0.38 + 18, {
    size: 8,
    align: "center",
    alpha: 0.85,
  });
  drawOptionList(ctx, confirmQuitOptionRects(), selected);
  ctx.restore();
}

// --- Écran d'aide ---

function infoContinueRect() {
  return { x: RES_W / 2, y: RES_H * 0.86, w: 200, h: 18 };
}

export function hitTestInfoContinue(x, y) {
  return pointInRect(x, y, infoContinueRect());
}

// Pagination (voir states/help.js, HELP_PAGES) — juste au-dessus de
// CONTINUER, jamais chevauchée quel que soit le contenu de la page.
function infoPrevRect() {
  return { x: RES_W * 0.32, y: RES_H * 0.78, w: 70, h: 16 };
}

function infoNextRect() {
  return { x: RES_W * 0.68, y: RES_H * 0.78, w: 70, h: 16 };
}

export function hitTestInfoPrev(x, y) {
  return pointInRect(x, y, infoPrevRect());
}

export function hitTestInfoNext(x, y) {
  return pointInRect(x, y, infoNextRect());
}

// Découpe une chaîne en lignes qui tiennent dans maxWidth (measureText).
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

// Contenu en une seule colonne centrée, réparti sur plusieurs pages
// (page/pageCount, voir states/help.js). Chaque page ne contient qu'un seul
// type de contenu : des sections de texte (content.sections) ou une légende
// (content.showBonusLegend OU content.showEnemyLegend), jamais combinés.
export function drawInfoScreen(ctx, content, page, pageCount) {
  ctx.save();
  // Pas de fond opaque ici : le champ d'étoiles (dessiné par game.js avant
  // cet appel) doit rester visible, comme sur les autres écrans-menus.
  text(ctx, content.title, RES_W / 2, RES_H * 0.09, {
    size: 14,
    align: "center",
    color: PALETTE.bulletPlayer,
    glow: PALETTE.bulletPlayer,
  });

  const centerX = RES_W / 2;
  const contentWidth = RES_W * 0.82; // presque toute la largeur, une seule colonne
  const detailFont = "8px monospace";
  const lineH = 10;
  const sectionGap = 12;
  let y = RES_H * 0.09 + 30;

  if (content.sections) {
    ctx.font = detailFont; // pour measureText dans wrapLines ci-dessous
    for (const section of content.sections) {
      text(ctx, section.heading, centerX, y, {
        size: 10,
        align: "center",
        color: PALETTE.player,
        glow: PALETTE.player,
      });
      y += 14;
      const lines = wrapLines(ctx, section.detail, contentWidth);
      for (const line of lines) {
        text(ctx, line, centerX, y, { size: 8, align: "center" });
        y += lineH;
      }
      y += sectionGap;
    }
  }

  // Légende bonus/ennemis : icônes identiques à ce qui apparaît en jeu
  // (drawPowerupIcon partagé avec powerups.js ; sprite réel d'assets.js pour
  // les ennemis) — le joueur associe l'apparence à l'effet sans avoir à le
  // vérifier en jeu.
  if (content.showBonusLegend) {
    const rowH = 22;
    Object.keys(POWERUP.types).forEach((type, i) => {
      const rowY = y + i * rowH;
      const def = POWERUP.types[type];
      drawPowerupIcon(ctx, centerX - 120, rowY, type, 5);
      text(ctx, `${t(`powerup.${type}`)} — ${t(`powerup.${type}.effect`)}`, centerX - 100, rowY, { size: 8, align: "left", color: def.color });
    });
  }

  if (content.showEnemyLegend) {
    const rowH = 22;
    const enemySprites = buildSprites();
    ENEMY_LEGEND.forEach((en, i) => {
      const rowY = y + i * rowH;
      drawWithGlow(ctx, enemySprites[en.spriteKey], centerX - 120, rowY);
      text(ctx, en.text, centerX - 100, rowY, { size: 8, align: "left", color: en.color });
    });
  }

  const prevR = infoPrevRect();
  const nextR = infoNextRect();
  // Grisée plutôt que masquée aux extrémités : la position du bouton reste
  // stable, seule son opacité indique qu'il n'y a rien de plus dans ce sens.
  text(ctx, t("help.prev"), prevR.x, prevR.y, { size: 9, align: "center", alpha: page > 0 ? 1 : 0.3 });
  text(ctx, `${page + 1}/${pageCount}`, RES_W / 2, prevR.y, { size: 9, align: "center", color: PALETTE.hud });
  text(ctx, t("help.next"), nextR.x, nextR.y, { size: 9, align: "center", alpha: page < pageCount - 1 ? 1 : 0.3 });

  const r = infoContinueRect();
  text(ctx, t("help.continue"), r.x, r.y, {
    size: 11,
    align: "center",
    color: PALETTE.bulletPlayer,
    glow: PALETTE.bulletPlayer,
  });
  ctx.restore();
}

// --- Écran "GAME OVER" (après le ralenti de mort) : rejouer aussitôt, ou
// passer par la saisie du nom/le classement ---

function drawGameOverScreen(ctx, score, wave, kills, distance) {
  text(ctx, t("gameover.title"), RES_W / 2, RES_H * 0.28, { size: 20, align: "center", color: PALETTE.danger, glow: PALETTE.danger });
  text(ctx, t("gameover.stats", { score, wave, kills }), RES_W / 2, RES_H * 0.28 + 22, { size: 10, align: "center" });
  text(ctx, t("gameover.distance", { distance: Math.round(distance) }), RES_W / 2, RES_H * 0.28 + 34, { size: 7, align: "center", alpha: 0.8 });
}

// La seconde option mène à la saisie du pseudo quand le score entre dans le
// classement (qualifies), sinon au classement.
function gameOverOptionRects(qualifies) {
  const labels = [t("gameover.replay"), t(qualifies ? "gameover.enterName" : "menu.leaderboard")];
  return verticalOptionRects(labels, RES_H * 0.62, 20, 200, 18);
}

export function hitTestGameOver(x, y) {
  return hitTestRects(x, y, gameOverOptionRects(false));
}

// topSize : la taille du classement si le score y entre (pour l'annoncer), 0 sinon.
export function drawDeathScreen(ctx, score, wave, kills, distance, selected, topSize) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, RES_W, RES_H);
  drawGameOverScreen(ctx, score, wave, kills, distance);
  if (topSize) {
    text(ctx, t("gameover.top", { size: topSize }), RES_W / 2, RES_H * 0.51, {
      size: 10,
      align: "center",
      color: PALETTE.bulletPlayer,
      glow: PALETTE.bulletPlayer,
    });
  }
  drawOptionList(ctx, gameOverOptionRects(topSize > 0), selected, 12);
  ctx.restore();
}

// Saisie du pseudo : tout tient dans la moitié haute de l'écran, que le
// clavier virtuel d'un téléphone en paysage ne recouvre pas.
const NAME_ENTRY_Y = 34;

// Bouton tactile pour valider le nom — indispensable sur mobile où le
// clavier virtuel n'apparaît pas toujours (goToLeaderboard dans states/endOfRun.js).
function nameEntryValidateRect() {
  return { x: RES_W / 2, y: NAME_ENTRY_Y + 84, w: 200, h: 18 };
}

export function hitTestNameEntryValidate(x, y) {
  return pointInRect(x, y, nameEntryValidateRect());
}

export function drawNameEntry(ctx, name, cursorVisible, score, wave, kills) {
  text(ctx, t("name.title"), RES_W / 2, NAME_ENTRY_Y, { size: 12, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });
  text(ctx, t("gameover.stats", { score, wave, kills }), RES_W / 2, NAME_ENTRY_Y + 20, { size: 9, align: "center" });
  text(ctx, t("name.prompt"), RES_W / 2, NAME_ENTRY_Y + 42, { size: 7, align: "center", alpha: 0.8 });
  // Pas de curseur une fois les 8 caractères saisis : il n'y a plus de place.
  const shown = name + (cursorVisible && name.length < 8 ? "_" : "");
  text(ctx, shown.padEnd(8, "·"), RES_W / 2, NAME_ENTRY_Y + 60, { size: 14, align: "center", glow: PALETTE.hud });
  const r = nameEntryValidateRect();
  text(ctx, t("name.validate"), r.x, r.y, { size: 11, align: "center", color: PALETTE.bulletPlayer, glow: PALETTE.bulletPlayer });
}
