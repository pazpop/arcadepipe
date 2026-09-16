// Machine à états du jeu : menu, partie, pause, saisie du nom, classement,
// crédits — et gestion des vagues/transitions pendant l'état "playing".
import { RES_W, RES_H, PALETTE, DIFFICULTY, PLAYER, POWERUP, STORAGE_KEYS } from "./config.js";
import { createStarfield, updateStarfield, drawStarfield, spawnDeathStarBackdrop, triggerDeathStarLeave } from "./stars.js";
import { createPlayer, resetPlayer, updatePlayer, hitPlayer, drawPlayer, applyPowerup, applyShield } from "./player.js";
import { createProjectiles, updateProjectiles, drawProjectiles } from "./projectiles.js";
import { createParticlePool, updateParticles, drawParticles, spawnExplosion, spawnFlashBurst, spawnSpark } from "./particles.js";
import { createEnemyPool, spawnEnemyWave, updateEnemies, setEnemiesLeaving, damageEnemy, pointsFor, drawEnemies } from "./enemies.js";
import { spawnBoss, updateBoss, hitBossWeakPoint, hitsBossHull, drawBoss } from "./boss.js";
import { createPowerupPool, spawnPowerup, updatePowerups, drawPowerups } from "./powerups.js";
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

// Accessibilité : désactive le screen shake pour les joueurs sensibles au
// mouvement (réglage système, pas une option en jeu).
const REDUCED_MOTION =
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Vibration mobile (Vibration API) : no-op silencieux si indisponible
// (desktop, Safari/iOS) ou refusée — jamais bloquant pour le jeu.
function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignoré */
  }
}

// Aides de jeu (première partie, premier boss) — vues une seule fois par
// navigateur (ensuite accessible à tout moment via le bouton "Aide").
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

// Pseudo mémorisé d'une partie à l'autre — pré-remplit la saisie du nom
// (voir handleGameOver) sans empêcher de le modifier avant de valider.
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

// Glissée d'entrée du vaisseau (voir startRun/updateShipIntro) : arrive
// doucement depuis la gauche hors écran plutôt que d'apparaître directement
// au milieu du combat — les premiers ennemis sont retardés d'autant (voir
// g.spawnTimer dans startRun) pour laisser le temps à l'animation.
const SHIP_INTRO_DURATION = 1.8;

// Un seul écran d'aide, organisé par catégories — montré automatiquement à
// la toute première partie, et accessible à tout moment ensuite via le
// bouton "Aide" (panneau bas gauche), le menu principal ou la pause
// (MODE.HELP, g.helpReturnTo indique où revenir en le fermant).
const HELP_INFO = {
  title: "AIDE",
  sections: [
    { heading: "DÉPLACEMENT", detail: "Souris ou doigt : dirige le vaisseau" },
    { heading: "TIR", detail: 'Maintiens le clic, ou coche "TIR AUTO" (bas à gauche)' },
    { heading: "BONUS", detail: "Ennemis détruits : PUISSANCE/RAFALE/BOUCLIER, rarement NOVA" },
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
    enemiesKilled: 0, // total de la partie (contrairement à waveKills, qui se réinitialise à chaque vague) — affiché au Game Over et envoyé au classement
    wave: 1,
    waveKills: 0,
    waveKillTarget: DIFFICULTY.baseWaveKills,
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

  function eliteChance() {
    return Math.min(0.25, 0.06 + g.wave * 0.015);
  }

  // Tire un type de bonus selon POWERUP.typeWeights (nova nettement plus
  // rare que power/rapid) plutôt qu'un simple 50/50.
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
      // Filet de sécurité : garantit qu'aucun décor de boss ne traîne au
      // début d'une vague normale (partie recommencée après un abandon en
      // plein combat, boss suivant plus loin dans la roadmap, etc.) —
      // l'effacement animé (triggerDeathStarLeave, sur victoire) reste le
      // chemin normal, ceci n'est qu'un rattrapage.
      starfield.deathStar = null;
    }
  }

  function startRun() {
    music.playRandom();
    resetPlayer(player);
    for (const b of projectiles.player.items) b.active = false;
    for (const b of projectiles.enemy.items) b.active = false;
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
    g.mode = MODE.PLAYING;
    g.controlHint = 4;
    startWave(1);

    // Entrée en douceur (vague 1, une fois par partie) : le vaisseau glisse
    // depuis hors écran à gauche pendant que les premiers ennemis sont
    // retardés d'autant (au lieu d'arriver instantanément "en plein combat").
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

  async function goToLeaderboard(returnTo) {
    g.mode = MODE.LEADERBOARD;
    g.leaderboardReturnTo = returnTo;
    g.scores = [];
    g.scoresRevealCount = 0;
    g.scoresRevealTimer = 0;
    try {
      g.scores = await fetchTopScores(10);
    } catch {
      g.scores = [];
    }
    try {
      g.gamesPlayed = await fetchGamesPlayedCount();
    } catch {
      g.gamesPlayed = null; // affichage masqué plutôt qu'un faux "0" (voir drawLeaderboardScreen)
    }
  }

  async function handleGameOver() {
    g.mode = MODE.NAME_ENTRY;
    g.nameEntry = readLastPlayerName() || randomPilotName();
    // Comptabilisée dès la fin de la partie, peu importe si le score
    // qualifie ou non pour le top — voir POST /api/games côté backend.
    // Fire-and-forget : un échec réseau ne doit jamais bloquer la suite.
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
    // focus() ici arrive après un `await` — donc hors du geste utilisateur
    // synchrone d'origine, ce que la plupart des navigateurs mobiles
    // refusent pour ouvrir le clavier virtuel (aucune erreur, le clavier ne
    // s'ouvre juste jamais). D'où le nom aléatoire déjà rempli ci-dessus et
    // le bouton "VALIDER" tactile (voir hitTestNameEntryValidate) : sur
    // mobile, on peut valider sans clavier. Sur desktop, focus() marche
    // toujours et permet de taper par-dessus.
    if (nameInputEl) {
      nameInputEl.value = g.nameEntry;
      nameInputEl.focus();
    }
  }

  // Nom par défaut aléatoire — évite un nom vide/"PILOTE" générique quand la
  // saisie au clavier échoue (mobile, voir handleGameOver), tout en restant
  // amusant à garder tel quel plutôt qu'un simple timestamp.
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

    // Balles alliées vs ennemis normaux/élites
    for (const b of projectiles.player.items) {
      if (!b.active) continue;
      for (const en of enemies.items) {
        if (!en.active) continue;
        if (!circlesOverlap(b.x, b.y, projectiles.player.radius, en.x, en.y, en.radius)) continue;
        b.active = false;
        const destroyed = damageEnemy(en, particles, b.damage || 1);
        if (destroyed) {
          g.score += pointsFor(en);
          g.waveKills += 1;
          g.enemiesKilled += 1;
          audio.playExplosion();
          // Pas de tremblement d'écran pour un ennemi "classique" détruit —
          // réservé aux coups encaissés et à la victoire sur un boss, sinon
          // l'écran tremble en permanence dès qu'on tire.
          triggerHitStop(en.type === "elite" ? 0.05 : 0.03);
          // Un seul bonus visible à la fois, et aucun tant qu'un est déjà
          // actif sur le vaisseau — évite le gâchis (bonus qui expirent sans
          // avoir été vus) et garde le HUD lisible.
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

    // Balles alliées vs points faibles du boss
    if (g.boss && !g.boss.victory) {
      for (const b of projectiles.player.items) {
        if (!b.active) continue;
        const res = hitBossWeakPoint(g.boss, b.x, b.y, projectiles.player.radius, particles, b.damage || 1);
        if (res) {
          b.active = false;
          if (res === true) {
            g.score += 300;
            triggerShake(6);
            triggerHitStop(0.06);
            audio.playExplosion();
            if (g.boss.victory) {
              g.score += 1000;
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

    // Tirs ennemis vs joueur
    for (const eb of projectiles.enemy.items) {
      if (!eb.active) continue;
      if (circlesOverlap(eb.x, eb.y, projectiles.enemy.radius, player.x, player.y, PLAYER.hitboxRadius)) {
        eb.active = false;
        const res = hitPlayer(player);
        if (res === "shield") onShieldHit();
        else if (res) onPlayerHit();
      }
    }

    // Corps des ennemis vs joueur
    for (const en of enemies.items) {
      if (!en.active) continue;
      if (circlesOverlap(en.x, en.y, en.radius, player.x, player.y, PLAYER.hitboxRadius)) {
        en.active = false;
        spawnExplosion(particles, en.x, en.y, 8, PALETTE.enemyNormal);
        const res = hitPlayer(player);
        if (res === "shield") onShieldHit();
        else if (res) onPlayerHit();
      }
    }

    // Coque du boss vs joueur — foncer dedans doit faire mal, même si seuls
    // les points faibles TIRÉS endommagent le boss lui-même (voir
    // hitsBossHull dans boss.js, qui ne touche jamais à ses PV). Rien
    // pendant le fondu de victoire (la coque se dissipe, plus un obstacle).
    if (g.boss && !g.boss.victory && hitsBossHull(g.boss, player.x, player.y, PLAYER.hitboxRadius)) {
      const res = hitPlayer(player);
      if (res === "shield") onShieldHit();
      else if (res) onPlayerHit();
    }

    // Ramassage des bonus
    for (const pu of powerups.items) {
      if (!pu.active) continue;
      if (circlesOverlap(pu.x, pu.y, POWERUP.radius, player.x, player.y, PLAYER.hitboxRadius + 3)) {
        pu.active = false;
        audio.playPowerup();
        spawnFlashBurst(particles, pu.x, pu.y, 8);
        if (POWERUP.types[pu.type].instant) {
          triggerNova();
        } else if (pu.type === "shield") {
          applyShield(player, POWERUP.shieldHits);
        } else {
          applyPowerup(player, pu.type);
        }
      }
    }
  }

  // Bonus NOVA : effet instantané, pas un buff temporisé — détruit tout ce
  // qui est actif dans le pool d'ennemis (normaux + élites) ainsi que tous
  // leurs tirs en vol (sinon un mur de balles déjà lancé reste mortel
  // malgré l'écran "nettoyé"), pas le boss lui-même (garder un vrai combat
  // de boss malgré un ramassage chanceux).
  function triggerNova() {
    let killed = 0;
    for (const en of enemies.items) {
      if (!en.active) continue;
      en.active = false;
      spawnExplosion(particles, en.x, en.y, en.type === "elite" ? 20 : 12, PALETTE[`enemy${en.type === "elite" ? "Elite" : "Normal"}`]);
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
      audio.playExplosion();
      g.flash = Math.max(g.flash, 0.7);
      triggerShake(12);
      g.banner = { text: "NOVA !", timer: 1.2 };
    }
  }

  // Coup absorbé par le bouclier : pas de vie perdue, réaction plus légère
  // qu'un vrai impact (pas de hit-stop/vibration/explosion du vaisseau).
  function onShieldHit() {
    triggerShake(4);
    audio.playBossHit();
    spawnExplosion(particles, player.x, player.y, 10, PALETTE.shield);
  }

  function onPlayerHit() {
    triggerShake(10);
    triggerHitStop(0.08);
    vibrate(40);
    audio.playExplosion();
    spawnExplosion(particles, player.x, player.y, 18, PALETTE.player);
    spawnFlashBurst(particles, player.x, player.y, 8);
    if (!player.alive && !g.dying) {
      // Séquence cinématique avant l'écran "GAME OVER" : le temps ralentit
      // pendant quelques instants (voir le ralenti dans updatePlayingMode)
      // plutôt que de couper directement vers la saisie du nom.
      g.dying = true;
      g.deathTimer = PLAYER.invulnDuration + 0.2;
      triggerShake(16);
    }
  }

  // Glissée d'entrée du vaisseau (vague 1) : interpole sa position
  // directement plutôt que de passer par updatePlayer/le suivi de la
  // souris — évite qu'un mouvement de souris pendant l'animation ne la
  // court-circuite. La cible du joueur (input.x/y) n'est pas touchée : une
  // fois l'intro finie, le contrôle reprend normalement là où le doigt/la
  // souris se trouve déjà, sans saut brutal.
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

  // --- Update par état ---

  function updatePlayingMode(dt) {
    // Micro-gel d'impact sur les coups marquants : dt fortement réduit mais
    // pas nul (pas de vraie pause, juste un "punch" ressenti) plutôt qu'un
    // système de timing séparé — voir triggerHitStop().
    if (g.hitStop > 0) {
      g.hitStop = Math.max(0, g.hitStop - dt);
      dt *= 0.06;
    }

    if (g.dying) {
      // Ralenti cinématique après la mort — beaucoup plus long et prononcé
      // que le micro-gel d'impact ci-dessus, le monde continue de bouger
      // (ennemis, tirs, étoiles) mais au ralenti, jusqu'à l'écran GAME OVER.
      g.deathTimer -= dt;
      dt *= 0.16;
      if (g.deathTimer <= 0) {
        g.dying = false;
        g.mode = MODE.GAME_OVER;
        // Rien ne décrémente plus g.shake une fois hors de updatePlayingMode
        // (updateGameOverMode() ne le fait pas) — sans ça, un reliquat de
        // tremblement (le ralenti l'atténue mais ne l'annule pas forcément)
        // resterait figé et secouerait l'écran indéfiniment sur GAME OVER.
        g.shake = 0;
        return;
      }
    } else if (g.shipIntro) {
      updateShipIntro(dt);
    } else {
      updatePlayer(
        player,
        input,
        projectiles,
        dt,
        (colorKey) => {
          audio.playPlayerShot(colorKey);
        },
        !g.clearingScreen
      );

      if (consumeJustPressed(input, "KeyP") || consumeJustPressed(input, "Escape")) {
        g.mode = MODE.PAUSED;
        g.pauseSelected = 0;
        g.pauseStage = "menu";
        return;
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
    } else {
      g.clearingScreen = false;
      const waveDone = g.boss ? g.boss.victory : g.waveKills >= g.waveKillTarget;
      if (waveDone) {
        // Un peu plus long après un boss (voir DIFFICULTY.bossWaveBreakDuration)
        // — le temps que le décor "Étoile Noire" et les derniers ennemis en
        // fuite ci-dessous aient bien quitté l'écran.
        g.waveBreakDuration = g.boss ? DIFFICULTY.bossWaveBreakDuration : DIFFICULTY.waveBreakDuration;
        g.waveBreak = g.waveBreakDuration;
        g.flash = Math.max(g.flash, 0.3);
        g.banner = { text: `VAGUE ${g.wave} TERMINÉE`, timer: g.waveBreakDuration };
        // Les tirs/bonus en jeu disparaissent immédiatement (rester actifs
        // pendant le saut spatial n'aurait pas de sens), mais les vaisseaux
        // ennemis eux-mêmes défilent vers la gauche comme le fond étoilé
        // (voir enemyLeaveSpeed dans enemies.js) plutôt que de disparaître
        // d'un coup — le boss, lui, reste visible jusqu'à startWave (son
        // explosion de victoire doit rester à l'écran).
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
    } else if (g.waveBreak <= 0) {
      g.spawnTimer -= dt;
      if (g.spawnTimer <= 0) {
        spawnEnemyWave(enemies, g.wave, eliteChance());
        g.spawnTimer = Math.max(0.12, g.spawnInterval + (Math.random() - 0.5) * 0.15);
      }
    }

    resolveCollisions();
  }

  function selectPauseOption(index) {
    if (index === 0) {
      g.mode = MODE.PLAYING;
    } else if (index === 1) {
      g.helpReturnTo = MODE.PAUSED;
      g.mode = MODE.HELP;
    } else {
      // Quitter une partie en cours perd toute la progression — on demande
      // confirmation plutôt que de trancher sur un simple clic/Entrée.
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

  // La surbrillance clavier (flèches) est un index qu'on modifie nous-mêmes ;
  // le survol souris doit faire pareil à chaque frame plutôt que de rester
  // figé sur la dernière sélection clavier. Pas de survol au tactile (pas de
  // position avant le tap).
  function syncHover(hitTestFn, apply) {
    if (input.isTouch) return;
    const idx = hitTestFn(input.x, input.y);
    if (idx >= 0) apply(idx);
  }

  // Comme syncHover, mais joue un léger "tic" quand le survol change
  // réellement d'item — pas à chaque frame tant qu'on reste sur le même,
  // sinon ce serait un bourdonnement continu plutôt qu'un retour ponctuel.
  // Réservé aux écrans à plusieurs options (menu, pause, confirmation) —
  // les écrans à bouton unique gardent syncHover() tel quel.
  function syncHoverWithSound(hitTestFn, getCurrent, setCurrent) {
    if (input.isTouch) return;
    const idx = hitTestFn(input.x, input.y);
    if (idx < 0) return;
    if (idx !== getCurrent()) audio.playMenuHover();
    setCurrent(idx);
  }

  // Referme l'aide et revient là où elle a été ouverte (menu, pause, ou
  // directement en jeu pour l'aide automatique de la toute première partie).
  function closeHelp() {
    g.mode = g.helpReturnTo;
    if (g.helpReturnTo === MODE.PAUSED) g.pauseStage = "menu";
  }

  // Ouvre l'aide depuis le bouton du panneau (bas gauche), visible aussi
  // bien au menu qu'en pleine partie — contrairement à l'entrée du menu
  // pause, ici on n'est pas forcément déjà en pause. Pas d'effet depuis un
  // écran sans retour cohérent (classement, crédits, saisie du nom...).
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

    // Toute touche "front montant" non consommée par l'état courant (ex:
    // flèche pressée pendant NAME_ENTRY) ne doit pas fuiter vers l'état
    // suivant une fois qu'on en change — nettoyage en fin de frame plutôt
    // qu'en début, pour laisser aux handlers ci-dessus la chance de la lire.
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

    // Le classement/crédits gardent un fond uni — le starfield derrière un
    // tableau de scores nuit à la lisibilité, et resterait figé de toute
    // façon puisqu'il n'est pas mis à jour dans ces états.
    const showStarfield =
      g.mode === MODE.PLAYING || g.mode === MODE.PAUSED || g.mode === MODE.GAME_OVER || g.mode === MODE.MENU || g.mode === MODE.HELP;
    if (showStarfield) drawStarfield(ctx, starfield, g.mode === MODE.PLAYING ? g.warp : 1);

    if (g.mode === MODE.PLAYING || g.mode === MODE.PAUSED || g.mode === MODE.GAME_OVER) {
      drawEnemies(ctx, enemies);
      if (g.boss) drawBoss(ctx, g.boss);
      drawPowerups(ctx, powerups);
      drawParticles(ctx, particles);
      drawProjectiles(ctx, projectiles);
      drawPlayer(ctx, player);
      hud.drawGameHud(ctx, g, player.lives);
      hud.drawBuffIndicator(ctx, player.buff);
      hud.drawShieldIndicator(ctx, player.shield);
      hud.drawBanner(ctx, g.banner);
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

  // Pause forcée depuis l'extérieur (ex: onglet/app en arrière-plan côté
  // main.js) — no-op si une partie n'est pas en cours.
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
