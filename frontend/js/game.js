// Machine à états du jeu : menu, partie, pause, saisie du nom, classement,
// crédits — et gestion des vagues/transitions pendant l'état "playing".
import { RES_W, RES_H, PALETTE, DIFFICULTY, PLAYER, POWERUP, BONUS_LEVEL, STORAGE_KEYS } from "./config.js";
import { createStarfield, updateStarfield, drawStarfield, spawnDeathStarBackdrop, triggerDeathStarLeave } from "./stars.js";
import { createPlayer, resetPlayer, updatePlayer, hitPlayer, drawPlayer, applyPowerup, applyShield } from "./player.js";
import { createProjectiles, updateProjectiles, drawProjectiles } from "./projectiles.js";
import { createParticlePool, updateParticles, drawParticles, spawnExplosion, spawnFlashBurst, spawnSpark } from "./particles.js";
import { createEnemyPool, spawnEnemyWave, updateEnemies, setEnemiesLeaving, damageEnemy, pointsFor, drawEnemies, enemyGlowColor } from "./enemies.js";
import { spawnBoss, updateBoss, hitBossWeakPoint, hitsBossHull, drawBoss } from "./boss.js";
import { createPowerupPool, spawnPowerup, updatePowerups, drawPowerups } from "./powerups.js";
import { updateGraze, novaMaxForWave } from "./graze.js";
import { createBonusLevel, updateBonusLevel, drawBonusLevel, bonusLevelRewardFraction } from "./bonusLevel.js";
import { circlesOverlap } from "./collisions.js";
import { consumeJustPressed, clearJustPressed } from "./input.js";
import { fetchTopScores, submitScore, recordGamePlayed, fetchGamesPlayedCount } from "./audio/leaderboard.js";
import * as hud from "./hud.js";

const MODE = {
  MENU: "menu",
  PLAYING: "playing",
  PAUSED: "paused",
  HELP: "help",
  GAME_OVER: "game_over",
  NAME_ENTRY: "name_entry",
  LEADERBOARD: "leaderboard",
  CREDITS: "credits",
};

// Accessibilité : coupe le screen shake pour les joueurs sensibles au mouvement (réglage système).
const REDUCED_MOTION =
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Vibration mobile : no-op silencieux si indisponible ou refusée.
function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignoré */
  }
}

// Aide vue une fois par navigateur (revoir via le bouton "Aide" ensuite).
function hasSeenHint(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function markHintSeen(key) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* stockage indisponible — pas bloquant */
  }
}

// Pseudo mémorisé d'une partie à l'autre — pré-remplit la saisie du nom (handleGameOver).
function readLastPlayerName() {
  try {
    return localStorage.getItem(STORAGE_KEYS.lastPlayerName);
  } catch {
    return null;
  }
}
function saveLastPlayerName(name) {
  try {
    localStorage.setItem(STORAGE_KEYS.lastPlayerName, name);
  } catch {
    /* stockage indisponible — pas bloquant */
  }
}

// Entrée en douceur du vaisseau (startRun/updateShipIntro) : glisse depuis la
// gauche, premiers ennemis retardés d'autant (g.spawnTimer).
const SHIP_INTRO_DURATION = 1.8;

// Écran d'aide unique par catégories — auto à la 1re partie, sinon via bouton
// "Aide"/menu/pause (g.helpReturnTo indique où revenir en le fermant).
const HELP_INFO = {
  title: "AIDE",
  showBonusLegend: true, // dessine icône + couleur de chaque bonus (voir drawInfoScreen dans hud.js) à la place d'une ligne "BONUS" ici
  sections: [
    { heading: "DÉPLACEMENT", detail: "Souris ou doigt : dirige le vaisseau" },
    {
      heading: "TIR",
      detail:
        'Maintiens le clic, ou coche "TIR AUTO" (bas à gauche). NOVA (ESPACE ou bouton bas droite) une fois la jauge pleine — frôle les tirs ET les vaisseaux ennemis (pas le boss) pour la charger, prends des risques !',
    },
    { heading: "BOSS", detail: "Vise les points faibles JAUNES, évite sa coque — le vaincre donne +1 vie" },
    { heading: "MUSIQUE", detail: "Playlist aléatoire, réglable en bas à gauche" },
  ],
};

export function createGame({ input, audio, music, nameInputEl }) {
  const starfield = createStarfield();
  const player = createPlayer();
  const projectiles = createProjectiles();
  const particles = createParticlePool();
  const enemies = createEnemyPool();
  const powerups = createPowerupPool();

  const g = {
    mode: MODE.MENU,
    elapsed: 0,
    menuSelected: 0,
    pauseSelected: 0,
    pauseStage: "menu", // "menu" | "confirmQuit"
    confirmQuitSelected: 1, // par défaut sur NON — un Entrée accidentel ne doit pas faire perdre la partie
    helpReturnTo: MODE.MENU, // où revenir en fermant l'aide (MODE.MENU, MODE.PAUSED ou MODE.PLAYING)

    // Partie en cours
    score: 0,
    enemiesKilled: 0, // total partie (waveKills se réinitialise par vague) — Game Over + classement
    wave: 1,
    waveKills: 0,
    waveKillTarget: DIFFICULTY.baseWaveKills,
    tookDamageThisWave: false, // pour DIFFICULTY.noDamageWaveBonus — reset dans startWave, mis à true dans onPlayerHit
    grazeChain: 0, // reset dans startWave (pas startRun) — voir graze.js
    novaStock: 0, // rechargé par le graze, consommé par tryUseNova() — vide au début d'une partie (récompense à gagner)
    novaProgress: 0, // 0..1, progression vers la prochaine charge
    novaMax: 1, // recalculé dans startWave (novaMaxForWave)
    spawnTimer: 0,
    spawnInterval: DIFFICULTY.baseSpawnInterval,
    waveBreak: 0,
    waveBreakDuration: DIFFICULTY.waveBreakDuration, // mémorisé au déclenchement (normal ou bossWaveBreakDuration) pour calculer la courbe de warp
    warp: 1,
    warpSoundPlayed: false,
    shake: 0,
    flash: 0,
    hitStop: 0,
    banner: null,
    boss: null,
    bonusLevel: null, // niveau bonus en cours (voir bonusLevel.js) — null hors de ce niveau
    bonusLevelLastWave: 0, // dernière vague pour laquelle le niveau bonus a été offert (évite un double déclenchement)
    clearingScreen: false,
    controlHint: 0,
    dying: false, // séquence cinématique (ralenti) entre la mort et l'écran GAME OVER
    deathTimer: 0,
    shipIntro: false, // glissée d'entrée du vaisseau au tout début d'une partie (vague 1)
    shipIntroTimer: 0,

    // Classement
    scores: [],
    scoresRevealCount: 0,
    scoresRevealTimer: 0,
    leaderboardReturnTo: MODE.MENU,
    gamesPlayed: null, // total global (toutes parties) — voir goToLeaderboard

    // Crédits
    creditsScroll: 0,

    // Saisie du nom
    nameEntry: "",
  };

  function triggerShake(amount) {
    g.shake = Math.max(g.shake, REDUCED_MOTION ? 0 : amount);
  }

  function triggerHitStop(amount) {
    g.hitStop = Math.max(g.hitStop, REDUCED_MOTION ? 0 : amount);
  }

  // Probabilité qu'un ennemi normal soit une élite à la place — monte avec
  // la vague, plafonnée à 25% pour ne jamais dominer le flux d'ennemis normaux.
  function eliteChance() {
    return Math.min(0.25, 0.06 + g.wave * 0.015);
  }

  // Tire un type de bonus selon POWERUP.typeWeights.
  function pickPowerupType() {
    const weights = POWERUP.typeWeights;
    const total = Object.values(weights).reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (const [type, weight] of Object.entries(weights)) {
      r -= weight;
      if (r <= 0) return type;
    }
    return "power"; // filet de sécurité (erreurs d'arrondi flottant)
  }

  function isBossWave(wave) {
    return wave % DIFFICULTY.bossWaveEvery === 0;
  }

  function zonePalette() {
    return PALETTE.bgZones[Math.floor((g.wave - 1) / DIFFICULTY.bossWaveEvery) % PALETTE.bgZones.length];
  }

  function startWave(wave) {
    g.wave = wave;
    g.waveKills = 0;
    g.tookDamageThisWave = false;
    g.grazeChain = 0;
    g.novaMax = novaMaxForWave(wave);
    g.novaStock = Math.min(g.novaStock, g.novaMax);
    g.waveKillTarget = DIFFICULTY.baseWaveKills + (wave - 1) * DIFFICULTY.waveKillsStep;
    g.spawnInterval = Math.max(
      DIFFICULTY.minSpawnInterval,
      DIFFICULTY.baseSpawnInterval - (wave - 1) * DIFFICULTY.spawnIntervalStep
    );
    g.waveBreak = 0;
    g.boss = null;
    if (isBossWave(wave)) {
      g.banner = { text: `VAGUE ${wave} — ARME MASSIVE EN APPROCHE`, timer: 2.5 };
      g.boss = spawnBoss(wave);
      spawnDeathStarBackdrop(starfield);
    } else {
      g.banner = { text: `VAGUE ${wave}`, timer: 1.8 };
      // Filet de sécurité : évite qu'un décor de boss traîne au début d'une
      // vague normale (chemin normal = triggerDeathStarLeave à la victoire).
      starfield.deathStar = null;
    }
  }

  function startRun() {
    music.playRandom();
    resetPlayer(player);
    for (const b of projectiles.player.items) b.active = false;
    for (const b of projectiles.enemy.items) b.active = false;
    for (const b of projectiles.pellet.items) b.active = false;
    for (const e of enemies.items) e.active = false;
    for (const p of particles.items) p.active = false;
    for (const pu of powerups.items) pu.active = false;
    g.score = 0;
    g.enemiesKilled = 0;
    g.shake = 0;
    g.flash = 0;
    g.hitStop = 0;
    g.dying = false;
    g.deathTimer = 0;
    g.warp = 1;
    g.novaStock = 0; // vide au début d'une partie — la première charge doit être gagnée (voir graze.js)
    g.novaProgress = 0;
    g.bonusLevel = null;
    g.bonusLevelLastWave = 0;
    g.mode = MODE.PLAYING;
    g.controlHint = 4;
    startWave(1);

    // Entrée en douceur (vague 1 uniquement) — voir SHIP_INTRO_DURATION.
    g.shipIntro = true;
    g.shipIntroTimer = SHIP_INTRO_DURATION;
    player.x = -20;
    player.y = RES_H / 2;
    g.spawnTimer = SHIP_INTRO_DURATION;

    if (!hasSeenHint(STORAGE_KEYS.seenIntro)) {
      markHintSeen(STORAGE_KEYS.seenIntro);
      g.helpReturnTo = MODE.PLAYING;
      g.mode = MODE.HELP;
    }
  }

  // Jeton de version : un double-tap sur "Classement" lance deux fetch en
  // parallèle ; sans garde, la réponse arrivée en second gagnerait même si
  // périmée. Même correctif que _loadToken dans audio/music.js.
  let leaderboardToken = 0;

  async function goToLeaderboard(returnTo) {
    const token = ++leaderboardToken;
    g.mode = MODE.LEADERBOARD;
    g.leaderboardReturnTo = returnTo;
    g.scores = [];
    g.scoresRevealCount = 0;
    g.scoresRevealTimer = 0;
    let scores = [];
    try {
      scores = await fetchTopScores(10);
    } catch {
      scores = [];
    }
    if (token !== leaderboardToken) return; // supplantée par un appel plus récent
    g.scores = scores;
    let gamesPlayed = null;
    try {
      gamesPlayed = await fetchGamesPlayedCount();
    } catch {
      gamesPlayed = null; // affichage masqué plutôt qu'un faux "0" (voir drawLeaderboardScreen)
    }
    if (token !== leaderboardToken) return;
    g.gamesPlayed = gamesPlayed;
  }

  async function handleGameOver() {
    g.mode = MODE.NAME_ENTRY;
    g.nameEntry = readLastPlayerName() || randomPilotName();
    // Comptabilisée dès la fin de partie, qualifiée ou non (POST /api/games).
    // Fire-and-forget : un échec réseau ne doit pas bloquer la suite.
    recordGamePlayed().catch(() => {});
    let qualifies = true;
    try {
      const top = await fetchTopScores(10);
      qualifies = top.length < 10 || g.score > Math.min(...top.map((s) => s.score));
    } catch {
      qualifies = true; // backend indisponible : on tente quand même la saisie
    }
    if (!qualifies) {
      goToLeaderboard(MODE.MENU);
      return;
    }
    // focus() ici est hors du geste utilisateur d'origine (après un await) —
    // la plupart des mobiles refusent d'ouvrir le clavier virtuel dans ce
    // cas, sans erreur. D'où le nom aléatoire déjà rempli et le bouton
    // "VALIDER" tactile (hitTestNameEntryValidate) pour valider sans clavier.
    if (nameInputEl) {
      nameInputEl.value = g.nameEntry;
      nameInputEl.focus();
    }
  }

  // Nom par défaut aléatoire — évite un "PILOTE" générique si le clavier
  // n'apparaît pas (mobile, voir handleGameOver).
  function randomPilotName() {
    const n = 10 + Math.floor(Math.random() * 90); // 2 chiffres pile : "PILOTE" (6) + "42" = 8 car. max
    return `PILOTE${n}`;
  }

  async function confirmNameEntry() {
    const name = (g.nameEntry || "PILOTE").trim() || "PILOTE";
    saveLastPlayerName(name); // repris pré-rempli à la prochaine partie (voir handleGameOver)
    try {
      await submitScore(name, g.score, g.wave, g.enemiesKilled);
    } catch {
      /* échec silencieux : on affiche quand même le classement en l'état */
    }
    if (nameInputEl) nameInputEl.blur();
    goToLeaderboard(MODE.MENU);
  }

  // --- Collisions internes à l'état "playing" ---

  function resolveCollisions() {
    if (g.clearingScreen) return;

    // Balles alliées (tirs normaux + plombs CHEVROTINE) vs ennemis normaux/élites
    for (const pool of [projectiles.player, projectiles.pellet]) {
      for (const b of pool.items) {
        if (!b.active) continue;
        for (const en of enemies.items) {
          if (!en.active) continue;
          if (!circlesOverlap(b.x, b.y, pool.radius, en.x, en.y, en.radius)) continue;
          b.active = false;
          const destroyed = damageEnemy(en, particles, b.damage || 1);
          if (destroyed) {
            g.score += pointsFor(en);
            g.waveKills += 1;
            g.enemiesKilled += 1;
            audio.playExplosion();
            // Pas de shake sur un kill "classique" (réservé aux coups encaissés/
            // victoire boss), sinon l'écran tremble en permanence.
            triggerHitStop(en.type === "elite" ? 0.05 : 0.03);
            // Un seul bonus à la fois, aucun si déjà actif — évite le gâchis et
            // garde le HUD lisible.
            const noBonusInPlay = !player.buff && !player.shield && !powerups.items.some((pu) => pu.active);
            const dropChance = en.type === "elite" ? POWERUP.dropChanceElite : POWERUP.dropChanceNormal;
            if (noBonusInPlay && Math.random() < dropChance) {
              spawnPowerup(powerups, en.x, en.y, pickPowerupType());
            }
          } else {
            audio.playBossHit();
          }
          break;
        }
      }
    }

    // Balles alliées (tirs normaux + plombs) vs points faibles du boss
    if (g.boss && !g.boss.victory) {
      for (const pool of [projectiles.player, projectiles.pellet]) {
        for (const b of pool.items) {
          if (!b.active) continue;
          const res = hitBossWeakPoint(g.boss, b.x, b.y, pool.radius, particles, b.damage || 1);
          if (res) {
            b.active = false;
            if (res === true) {
              g.score += 300; // vaut un ennemi élite (TYPE_STATS.elite.points dans enemies.js)
              triggerShake(6);
              triggerHitStop(0.06);
              audio.playExplosion();
              if (g.boss.victory) {
                g.score += 1000; // bonus de victoire, nettement au-dessus d'un point faible pour marquer l'accomplissement
                player.lives = Math.min(PLAYER.maxLives, player.lives + 1); // récompense de victoire, plafonnée
                g.flash = Math.max(g.flash, 0.6);
                triggerShake(14);
                triggerHitStop(0.14);
                vibrate([40, 60, 40]);
                spawnExplosion(particles, g.boss.x, g.boss.y, 80, PALETTE.boss);
                spawnFlashBurst(particles, g.boss.x, g.boss.y, 24);
                triggerDeathStarLeave(starfield);
              }
            } else {
              audio.playBossHit();
            }
          }
        }
      }
    }

    // Tirs ennemis vs joueur
    for (const eb of projectiles.enemy.items) {
      if (!eb.active) continue;
      if (circlesOverlap(eb.x, eb.y, projectiles.enemy.radius, player.x, player.y, PLAYER.hitboxRadius)) {
        eb.active = false;
        applyHitToPlayer();
      }
    }

    // Corps des ennemis vs joueur
    for (const en of enemies.items) {
      if (!en.active) continue;
      if (circlesOverlap(en.x, en.y, en.radius, player.x, player.y, PLAYER.hitboxRadius)) {
        en.active = false;
        spawnExplosion(particles, en.x, en.y, 8, enemyGlowColor(en));
        applyHitToPlayer();
      }
    }

    // Coque du boss vs joueur : foncer dedans fait mal, même si seuls les
    // points faibles tirés endommagent le boss (hitsBossHull ne touche
    // jamais ses PV). Rien pendant le fondu de victoire.
    if (g.boss && !g.boss.victory && hitsBossHull(g.boss, player.x, player.y, PLAYER.hitboxRadius)) {
      applyHitToPlayer();
    }

    // Ramassage des bonus
    for (const pu of powerups.items) {
      if (!pu.active) continue;
      // +3 : marge généreuse, ramasser un bonus doit être plus tolérant qu'encaisser un tir.
      if (circlesOverlap(pu.x, pu.y, POWERUP.radius, player.x, player.y, PLAYER.hitboxRadius + 3)) {
        pu.active = false;
        audio.playPowerup();
        spawnFlashBurst(particles, pu.x, pu.y, 8);
        if (pu.type === "shield") {
          applyShield(player, POWERUP.shieldHits);
        } else {
          applyPowerup(player, pu.type);
        }
      }
    }
  }

  // NOVA : effet instantané (pas un buff) — détruit tous les ennemis actifs
  // et leurs tirs en vol (sinon un mur de balles resterait mortel), jamais
  // le boss (garde un vrai combat malgré un ramassage chanceux).
  function triggerNova() {
    let killed = 0;
    for (const en of enemies.items) {
      if (!en.active) continue;
      en.active = false;
      spawnExplosion(particles, en.x, en.y, en.type === "elite" ? 20 : 12, enemyGlowColor(en));
      g.score += pointsFor(en);
      g.waveKills += 1;
      g.enemiesKilled += 1;
      killed++;
    }
    for (const eb of projectiles.enemy.items) {
      if (!eb.active) continue;
      eb.active = false;
      spawnSpark(particles, eb.x, eb.y, 3);
    }
    if (killed > 0) {
      audio.playNovaBlast();
      g.flash = Math.max(g.flash, 0.7);
      triggerShake(12);
      g.banner = { text: "NOVA !", timer: 1.2 };
    }
  }

  // Déclenchement manuel de la jauge NOVA (touche Espace ou bouton tactile
  // dédié, voir input.justPressed "NovaTrigger" dans main.js) — réutilise
  // triggerNova() tel quel, seule la façon de l'obtenir/déclencher change.
  function tryUseNova() {
    if (g.novaStock <= 0) return;
    g.novaStock -= 1;
    triggerNova();
  }

  // Récompense du niveau bonus (bonusLevel.js) : ajoutée à la jauge déjà en
  // cours plutôt que de l'écraser (un run imparfait ne fait jamais reculer ce
  // qui était déjà acquis par le graze), plafonnée au max courant.
  function applyNovaReward(frac) {
    const max = g.novaMax;
    let units = Math.min(max, g.novaStock + g.novaProgress + frac * max);
    g.novaStock = Math.floor(units);
    g.novaProgress = units - g.novaStock;
  }

  // Coup absorbé par le bouclier : pas de vie perdue, réaction plus légère qu'un vrai impact.
  function onShieldHit() {
    triggerShake(4);
    audio.playBossHit();
    spawnExplosion(particles, player.x, player.y, 10, PALETTE.shield);
  }

  function onPlayerHit() {
    g.tookDamageThisWave = true; // casse l'éligibilité au bonus DIFFICULTY.noDamageWaveBonus — un coup absorbé par le bouclier (onShieldHit) ne compte pas, lui
    triggerShake(10);
    triggerHitStop(0.08);
    vibrate(40);
    audio.playExplosion();
    spawnExplosion(particles, player.x, player.y, 18, PALETTE.player);
    spawnFlashBurst(particles, player.x, player.y, 8);
    if (!player.alive && !g.dying) {
      // Séquence cinématique avant "GAME OVER" : ralenti (voir updatePlayingMode)
      // plutôt qu'une coupure directe.
      g.dying = true;
      g.deathTimer = PLAYER.invulnDuration + 0.2;
      triggerShake(16);
    }
  }

  // Dispatch commun d'un coup reçu par le joueur — bouclier ou vie perdue
  // selon hitPlayer(), centralisé plutôt que répété par source de dégât.
  function applyHitToPlayer() {
    const res = hitPlayer(player);
    if (res === "shield") onShieldHit();
    else if (res) onPlayerHit();
  }

  // Glissée d'entrée (vague 1) : interpole la position directement (pas via
  // updatePlayer) pour qu'un mouvement de souris ne la court-circuite pas.
  // input.x/y n'est pas touché, donc le contrôle reprend sans saut à la fin.
  function updateShipIntro(dt) {
    g.shipIntroTimer -= dt;
    const t = Math.min(1, 1 - Math.max(0, g.shipIntroTimer) / SHIP_INTRO_DURATION);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic — ralentit en approchant la position finale
    const startX = -20;
    const targetX = RES_W * 0.18;
    player.x = startX + (targetX - startX) * eased;
    if (g.shipIntroTimer <= 0) {
      g.shipIntro = false;
    }
  }

  // Niveau bonus : x verrouillé (rail plutôt que déplacement libre, le
  // franchissement d'un anneau se juge au croisement de ce plan fixe — voir
  // updateBonusLevel dans bonusLevel.js), y toujours piloté par la souris/le
  // doigt comme en jeu normal.
  function updateBonusLevelShip(dt) {
    const targetX = RES_W * 0.18;
    const bl = g.bonusLevel;
    if (bl.introTimer > 0) {
      // Glissée d'entrée (même principe que updateShipIntro, début de
      // partie) : interpolation directe sur une durée fixe, pas le suivi par
      // vitesse ci-dessous (bien trop rapide pour rester visible sur
      // BONUS_LEVEL.introDuration). y immobile pendant la glissée — le
      // contrôle reprend sans saut une fois l'intro terminée.
      const t = Math.min(1, 1 - Math.max(0, bl.introTimer) / BONUS_LEVEL.introDuration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      player.x = -20 + (targetX + 20) * eased;
      player.y = RES_H / 2;
      return;
    }
    const dx = targetX - player.x;
    const maxStep = PLAYER.speed * dt;
    player.x = Math.abs(dx) <= maxStep ? targetX : player.x + Math.sign(dx) * maxStep;
    const dy = input.y - player.y;
    player.y = Math.abs(dy) <= maxStep ? input.y : player.y + Math.sign(dy) * maxStep;
    player.y = Math.max(6, Math.min(RES_H - 6, player.y));
  }

  // --- Update par état ---

  function updatePlayingMode(dt) {
    // Micro-gel d'impact : dt réduit mais pas nul (un "punch" ressenti, pas
    // une vraie pause) — voir triggerHitStop().
    if (g.hitStop > 0) {
      g.hitStop = Math.max(0, g.hitStop - dt);
      dt *= 0.06;
    }

    if (g.dying) {
      // Ralenti après la mort — plus long/prononcé que le micro-gel
      // ci-dessus, tout continue de bouger mais au ralenti jusqu'à GAME OVER.
      g.deathTimer -= dt;
      dt *= 0.16;
      if (g.deathTimer <= 0) {
        g.dying = false;
        g.mode = MODE.GAME_OVER;
        // Rien ne décrémente g.shake hors de updatePlayingMode — sans ce
        // reset, un reliquat de tremblement resterait figé sur GAME OVER.
        g.shake = 0;
        return;
      }
    } else {
      if (g.shipIntro) {
        updateShipIntro(dt);
      } else if (g.bonusLevel) {
        updateBonusLevelShip(dt);
      } else {
        updatePlayer(
          player,
          input,
          projectiles,
          dt,
          (colorKey) => {
            if (colorKey === "shotgun") audio.playShotgunBlast();
            else audio.playPlayerShot(colorKey);
          },
          !g.clearingScreen
        );
      }

      if (consumeJustPressed(input, "KeyP") || consumeJustPressed(input, "Escape")) {
        g.mode = MODE.PAUSED;
        g.pauseSelected = 0;
        g.pauseStage = "menu";
        return;
      }
      // "NovaTrigger" : jeton générique posé par le bouton tactile dédié
      // (main.js), consommé exactement comme une touche clavier. Inutile
      // pendant le niveau bonus (aucun ennemi normal à l'écran) — évite de
      // gâcher une charge sans effet.
      if (!g.clearingScreen && !g.bonusLevel && (consumeJustPressed(input, "Space") || consumeJustPressed(input, "NovaTrigger"))) {
        tryUseNova();
      }
    }

    // Vagues / transition "saut spatial"
    if (g.waveBreak > 0) {
      g.waveBreak -= dt;
      const p = g.waveBreak / g.waveBreakDuration;
      g.warp = 1 + 9 * (1 - Math.abs(p - 0.5) * 2);
      g.clearingScreen = true;
      if (g.waveBreak <= 0) {
        g.warp = 1;
        g.clearingScreen = false;
        g.warpSoundPlayed = false;
        startWave(g.wave + 1);
      }
    } else if (g.bonusLevel) {
      g.clearingScreen = true; // pas de tir pendant le niveau bonus, comme pendant un saut spatial
      g.warp = BONUS_LEVEL.warp;
      updateBonusLevel(g.bonusLevel, dt, player, particles, audio);
      if (g.bonusLevel.finished) {
        const frac = bonusLevelRewardFraction(g.bonusLevel);
        const passed = g.bonusLevel.passedCount;
        applyNovaReward(frac);
        g.bonusLevel = null;
        g.warp = 1;
        g.clearingScreen = false;
        g.waveBreakDuration = DIFFICULTY.waveBreakDuration;
        g.waveBreak = g.waveBreakDuration;
        g.banner = {
          text: `NIVEAU BONUS TERMINÉ : ${passed}/${BONUS_LEVEL.ringCount} ANNEAUX — NOVA +${Math.round(frac * 100)}%`,
          timer: g.waveBreakDuration,
        };
        if (!g.warpSoundPlayed) {
          audio.playWarpTransition();
          g.warpSoundPlayed = true;
        }
      }
    } else {
      g.clearingScreen = false;
      const waveDone = g.boss ? g.boss.victory : g.waveKills >= g.waveKillTarget;
      if (waveDone) {
        const nextWave = g.wave + 1;
        const bonusCycle = nextWave % BONUS_LEVEL.everyNWaves === 0 ? nextWave / BONUS_LEVEL.everyNWaves : 0;
        const bonusRequiredScore =
          bonusCycle === 1 ? BONUS_LEVEL.firstScoreThreshold : BONUS_LEVEL.scoreThreshold * bonusCycle;
        if (bonusCycle > 0 && nextWave !== g.bonusLevelLastWave && g.score >= bonusRequiredScore) {
          g.bonusLevelLastWave = nextWave;
          g.bonusLevel = createBonusLevel();
          // Glissée d'entrée du vaisseau (voir updateBonusLevelShip) — même
          // point de départ que l'intro de vague 1, le message explicatif
          // s'affiche pendant cette même phase (drawBonusLevelIntro).
          player.x = -20;
          player.y = RES_H / 2;
          setEnemiesLeaving(enemies);
          for (const b of projectiles.enemy.items) b.active = false;
          for (const pu of powerups.items) pu.active = false;
          return;
        }
        // Plus long après un boss (bossWaveBreakDuration) — le temps que le
        // décor et les derniers ennemis en fuite quittent l'écran.
        g.waveBreakDuration = g.boss ? DIFFICULTY.bossWaveBreakDuration : DIFFICULTY.waveBreakDuration;
        g.waveBreak = g.waveBreakDuration;
        g.flash = Math.max(g.flash, 0.3);
        if (!g.tookDamageThisWave) {
          g.score += DIFFICULTY.noDamageWaveBonus;
          g.banner = {
            text: `VAGUE ${g.wave} TERMINÉE — SANS DÉGÂTS ! +${DIFFICULTY.noDamageWaveBonus}`,
            timer: g.waveBreakDuration,
          };
          audio.playPowerup();
        } else {
          g.banner = { text: `VAGUE ${g.wave} TERMINÉE`, timer: g.waveBreakDuration };
        }
        // Tirs/bonus disparaissent immédiatement, mais les ennemis défilent
        // vers la gauche comme le fond (enemies.js) plutôt que de disparaître
        // d'un coup — le boss reste visible jusqu'à startWave (explosion de
        // victoire à l'écran).
        setEnemiesLeaving(enemies);
        for (const b of projectiles.enemy.items) b.active = false;
        for (const pu of powerups.items) pu.active = false;
        if (!g.warpSoundPlayed) {
          audio.playWarpTransition();
          g.warpSoundPlayed = true;
        }
      }
    }

    updateStarfield(starfield, dt, g.warp);

    if (g.banner) {
      g.banner.timer -= dt;
      if (g.banner.timer <= 0) g.banner = null;
    }

    g.shake = Math.max(0, g.shake - dt * 40);
    g.flash = Math.max(0, g.flash - dt * 1.5);
    g.controlHint = Math.max(0, g.controlHint - dt);

    updateProjectiles(projectiles, dt);
    updateParticles(particles, dt);
    updatePowerups(powerups, dt);

    updateEnemies(enemies, dt, projectiles, player, g.wave, g.warp);

    if (g.boss) {
      updateBoss(g.boss, dt, projectiles, player, particles);
    } else if (g.waveBreak <= 0 && !g.bonusLevel) {
      g.spawnTimer -= dt;
      if (g.spawnTimer <= 0) {
        spawnEnemyWave(enemies, g.wave, eliteChance());
        g.spawnTimer = Math.max(0.12, g.spawnInterval + (Math.random() - 0.5) * 0.15);
      }
    }

    resolveCollisions();
    // Après resolveCollisions() : un tir qui a touché ce frame est déjà
    // désactivé, donc jamais compté comme un graze en plus d'un vrai coup.
    updateGraze(g, dt, player, projectiles, enemies, particles, audio);
  }

  function selectPauseOption(index) {
    if (index === 0) {
      g.mode = MODE.PLAYING;
    } else if (index === 1) {
      g.helpReturnTo = MODE.PAUSED;
      g.mode = MODE.HELP;
    } else {
      // Quitter perd la progression — confirmation demandée plutôt qu'un simple clic/Entrée.
      g.pauseStage = "confirmQuit";
      g.confirmQuitSelected = 1;
    }
  }

  function selectConfirmQuitOption(index) {
    if (index === 0) {
      g.pauseStage = "menu";
      g.mode = MODE.MENU;
    } else {
      g.pauseStage = "menu";
    }
  }

  // Le survol souris doit suivre chaque frame (sinon reste figé sur la
  // dernière sélection clavier). Pas de survol au tactile.
  function syncHover(hitTestFn, apply) {
    if (input.isTouch) return;
    const idx = hitTestFn(input.x, input.y);
    if (idx >= 0) apply(idx);
  }

  // Comme syncHover, mais joue un "tic" seulement quand le survol change
  // d'item (pas à chaque frame). Réservé aux écrans à plusieurs options.
  function syncHoverWithSound(hitTestFn, getCurrent, setCurrent) {
    if (input.isTouch) return;
    const idx = hitTestFn(input.x, input.y);
    if (idx < 0) return;
    if (idx !== getCurrent()) audio.playMenuHover();
    setCurrent(idx);
  }

  // Referme l'aide et revient là où elle a été ouverte (menu, pause, ou en
  // jeu pour l'aide auto de la 1re partie).
  function closeHelp() {
    g.mode = g.helpReturnTo;
    if (g.helpReturnTo === MODE.PAUSED) g.pauseStage = "menu";
  }

  // Ouvre l'aide depuis le bouton du panneau — pas forcément déjà en pause,
  // contrairement à l'entrée du menu pause. No-op sur les écrans sans retour
  // cohérent (classement, crédits...).
  function openHelp() {
    if (g.mode === MODE.MENU || g.mode === MODE.PLAYING || g.mode === MODE.PAUSED) {
      g.helpReturnTo = g.mode;
      g.mode = MODE.HELP;
    }
  }

  function updateHelpMode() {
    if (consumeJustPressed(input, "Enter") || consumeJustPressed(input, "KeyP") || consumeJustPressed(input, "Escape")) {
      closeHelp();
    }
  }

  function updatePausedMode() {
    if (g.pauseStage === "confirmQuit") {
      syncHoverWithSound(hud.hitTestConfirmQuit, () => g.confirmQuitSelected, (idx) => (g.confirmQuitSelected = idx));
      if (consumeJustPressed(input, "ArrowUp") || consumeJustPressed(input, "ArrowDown")) {
        g.confirmQuitSelected = 1 - g.confirmQuitSelected;
      }
      if (consumeJustPressed(input, "Enter")) selectConfirmQuitOption(g.confirmQuitSelected);
      if (consumeJustPressed(input, "KeyP") || consumeJustPressed(input, "Escape")) {
        // Échap depuis la confirmation annule tout et reprend directement.
        g.pauseStage = "menu";
        g.mode = MODE.PLAYING;
      }
      return;
    }
    syncHoverWithSound(hud.hitTestPause, () => g.pauseSelected, (idx) => (g.pauseSelected = idx));
    if (consumeJustPressed(input, "ArrowUp")) g.pauseSelected = (g.pauseSelected + 2) % 3;
    if (consumeJustPressed(input, "ArrowDown")) g.pauseSelected = (g.pauseSelected + 1) % 3;
    if (consumeJustPressed(input, "Enter")) selectPauseOption(g.pauseSelected);
    if (consumeJustPressed(input, "KeyP") || consumeJustPressed(input, "Escape")) {
      g.mode = MODE.PLAYING;
    }
  }

  function updateMenuMode(dt) {
    g.elapsed += dt;
    updateStarfield(starfield, dt, 1);
    syncHoverWithSound(hud.hitTestMenu, () => g.menuSelected, (idx) => (g.menuSelected = idx));
    if (consumeJustPressed(input, "ArrowUp")) g.menuSelected = (g.menuSelected + 3) % 4;
    if (consumeJustPressed(input, "ArrowDown")) g.menuSelected = (g.menuSelected + 1) % 4;
    if (consumeJustPressed(input, "Enter")) selectMenuOption(g.menuSelected);
  }

  function selectMenuOption(index) {
    if (index === 0) startRun();
    else if (index === 1) goToLeaderboard(MODE.MENU);
    else if (index === 2) {
      g.helpReturnTo = MODE.MENU;
      g.mode = MODE.HELP;
    } else if (index === 3) {
      g.mode = MODE.CREDITS;
      g.creditsScroll = 0;
    }
  }

  function updateLeaderboardMode(dt) {
    g.scoresRevealTimer -= dt;
    if (g.scoresRevealTimer <= 0 && g.scoresRevealCount < g.scores.length) {
      g.scoresRevealCount += 1;
      g.scoresRevealTimer = 0.15;
    }
    if (consumeJustPressed(input, "Escape") || consumeJustPressed(input, "Enter")) {
      g.mode = g.leaderboardReturnTo;
    }
  }

  function updateCreditsMode(dt) {
    g.creditsScroll += dt * (input.fireHeld ? 90 : 22);
    const totalHeight = hud.CREDITS_LINES.length * 16 + RES_H;
    if (g.creditsScroll > totalHeight || consumeJustPressed(input, "Escape")) {
      g.mode = MODE.MENU;
    }
  }

  function updateGameOverMode() {
    syncHover(hud.hitTestGameOverContinue, () => {});
    if (consumeJustPressed(input, "Enter") || consumeJustPressed(input, "Escape")) {
      handleGameOver();
    }
  }

  function update(dt) {
    if (g.mode === MODE.PLAYING) updatePlayingMode(dt);
    else if (g.mode === MODE.PAUSED) updatePausedMode();
    else if (g.mode === MODE.GAME_OVER) updateGameOverMode();
    else if (g.mode === MODE.HELP) updateHelpMode();
    else if (g.mode === MODE.MENU) updateMenuMode(dt);
    else if (g.mode === MODE.LEADERBOARD) updateLeaderboardMode(dt);
    else if (g.mode === MODE.CREDITS) updateCreditsMode(dt);
    // MODE.NAME_ENTRY : piloté par les événements DOM du champ caché (voir main.js)

    // Une touche non consommée par l'état courant ne doit pas fuiter vers
    // l'état suivant — nettoyage en fin de frame, après que les handlers
    // ci-dessus aient pu la lire.
    clearJustPressed(input);
  }

  // --- Rendu ---

  function draw(ctx) {
    ctx.save();
    if (g.mode === MODE.PLAYING || g.mode === MODE.PAUSED || g.mode === MODE.GAME_OVER) {
      ctx.fillStyle = zonePalette();
    } else {
      ctx.fillStyle = PALETTE.bgDeep;
    }
    ctx.fillRect(0, 0, RES_W, RES_H);

    if (g.shake > 0 && (g.mode === MODE.PLAYING || g.mode === MODE.PAUSED || g.mode === MODE.GAME_OVER)) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    }

    // Classement/crédits gardent un fond uni — le starfield nuirait à la
    // lisibilité et resterait figé (non mis à jour dans ces états).
    const showStarfield =
      g.mode === MODE.PLAYING || g.mode === MODE.PAUSED || g.mode === MODE.GAME_OVER || g.mode === MODE.MENU || g.mode === MODE.HELP;
    if (showStarfield) drawStarfield(ctx, starfield, g.mode === MODE.PLAYING ? g.warp : 1);

    if (g.mode === MODE.PLAYING || g.mode === MODE.PAUSED || g.mode === MODE.GAME_OVER) {
      drawEnemies(ctx, enemies);
      if (g.boss) drawBoss(ctx, g.boss);
      if (g.bonusLevel) drawBonusLevel(ctx, g.bonusLevel);
      drawPowerups(ctx, powerups);
      drawParticles(ctx, particles);
      drawProjectiles(ctx, projectiles);
      drawPlayer(ctx, player);
      hud.drawGameHud(ctx, g, player.lives);
      hud.drawNovaGauge(ctx, g.novaStock, g.novaMax, g.novaProgress);
      if (g.boss) hud.drawBossHealthBar(ctx, g.boss);
      hud.drawBuffIndicator(ctx, player.buff);
      hud.drawShieldIndicator(ctx, player.shield);
      hud.drawBanner(ctx, g.banner);
      if (g.bonusLevel && g.bonusLevel.introTimer > 0) hud.drawBonusLevelIntro(ctx, g.bonusLevel.introTimer);
      hud.drawControlHint(ctx, g.controlHint);
      hud.drawFlash(ctx, g.flash);
      if (g.mode === MODE.PAUSED) {
        if (g.pauseStage === "confirmQuit") {
          hud.drawConfirmQuitScreen(ctx, g.confirmQuitSelected);
        } else {
          hud.drawPauseScreen(ctx, g.pauseSelected);
        }
      } else if (g.mode === MODE.GAME_OVER) {
        hud.drawDeathScreen(ctx, g.score, g.wave, g.enemiesKilled);
      }
    } else if (g.mode === MODE.MENU) {
      hud.drawTitleScreen(ctx, g.elapsed, g.menuSelected);
    } else if (g.mode === MODE.HELP) {
      hud.drawInfoScreen(ctx, HELP_INFO);
    } else if (g.mode === MODE.LEADERBOARD) {
      hud.drawLeaderboardScreen(ctx, g.scores, g.scoresRevealCount, g.gamesPlayed);
    } else if (g.mode === MODE.CREDITS) {
      hud.drawCreditsScreen(ctx, g.creditsScroll);
    } else if (g.mode === MODE.NAME_ENTRY) {
      hud.drawGameOverScreen(ctx, g.score, g.wave, g.enemiesKilled);
      hud.drawNameEntry(ctx, g.nameEntry, Math.floor(performance.now() / 400) % 2 === 0);
    }

    ctx.restore();
  }

  // Pause forcée depuis l'extérieur (onglet en arrière-plan, main.js) — no-op hors partie.
  function pause() {
    if (g.mode === MODE.PLAYING) {
      g.mode = MODE.PAUSED;
      g.pauseSelected = 0;
      g.pauseStage = "menu";
    }
  }

  function handleTap(x, y) {
    if (g.mode === MODE.MENU) {
      const idx = hud.hitTestMenu(x, y);
      if (idx >= 0) selectMenuOption(idx);
    } else if (g.mode === MODE.PAUSED) {
      if (g.pauseStage === "confirmQuit") {
        const idx = hud.hitTestConfirmQuit(x, y);
        if (idx >= 0) selectConfirmQuitOption(idx);
      } else {
        const idx = hud.hitTestPause(x, y);
        if (idx >= 0) selectPauseOption(idx);
      }
    } else if (g.mode === MODE.HELP) {
      if (hud.hitTestInfoContinue(x, y) === 0) closeHelp();
    } else if (g.mode === MODE.GAME_OVER) {
      if (hud.hitTestGameOverContinue(x, y) === 0) handleGameOver();
    } else if (g.mode === MODE.LEADERBOARD) {
      g.mode = g.leaderboardReturnTo;
    } else if (g.mode === MODE.CREDITS) {
      g.creditsScroll += 60;
    } else if (g.mode === MODE.NAME_ENTRY) {
      if (hud.hitTestNameEntryValidate(x, y) === 0) confirmNameEntry();
    }
  }

  return {
    MODE,
    get mode() {
      return g.mode;
    },
    get novaStock() {
      return g.novaStock;
    },
    get inBonusLevel() {
      return g.bonusLevel !== null;
    },
    update,
    draw,
    handleTap,
    pause,
    openHelp,
    setNameEntryText(text) {
      g.nameEntry = text.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 8);
    },
    confirmNameEntry,
  };
}
