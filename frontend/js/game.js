// Machine à états du jeu : menu, partie, pause, saisie du nom, classement,
// crédits — chaque écran vit dans states/, ce fichier les relie (état partagé
// `g`, bundle `engine`, dispatch update/draw/handleTap).
import { RES_W, RES_H, PALETTE, DIFFICULTY } from "./config.js";
import { createStarfield, updateStarfield, drawStarfield, createTwinkleStars } from "./stars.js";
import { createPlayer } from "./player.js";
import { createProjectiles } from "./projectiles.js";
import { createParticlePool } from "./particles.js";
import { createEnemyPool } from "./enemies.js";
import { createPowerupPool } from "./powerups.js";
import { clearJustPressed } from "./input.js";
import { MODE } from "./states/mode.js";
import * as menuState from "./states/menu.js";
import * as helpState from "./states/help.js";
import * as creditsState from "./states/credits.js";
import * as leaderboardScreen from "./states/leaderboardScreen.js";
import * as pausedState from "./states/paused.js";
import * as endOfRunState from "./states/endOfRun.js";
import * as playingState from "./states/playing.js";

export function createGame({ input, audio, music, nameInputEl }) {
  const starfield = createStarfield();
  const player = createPlayer();
  const projectiles = createProjectiles();
  const particles = createParticlePool();
  const enemies = createEnemyPool();
  const powerups = createPowerupPool();

  // Ce dont les modules de states/ ont besoin (voir states/menu.js pour
  // engine.actions). Rempli une fois ici.
  const engine = {
    input,
    audio,
    music,
    nameInputEl,
    starfield,
    player,
    projectiles,
    particles,
    enemies,
    powerups,
    actions: {
      startRun: () => playingState.startRun(g, engine),
      goToLeaderboard: (returnTo) => leaderboardScreen.open(g, returnTo),
    },
  };

  const g = {
    mode: MODE.MENU,
    elapsed: 0,
    menuSelected: 0,
    // Quelques étoiles qui scintillent en arrière-plan du menu principal
    // (même principe que le niveau bonus, voir states/menu.js et
    // createTwinkleStars dans stars.js) — un peu de vie derrière le titre.
    menuTwinkleStars: createTwinkleStars(10),
    pauseSelected: 0,
    gameOverSelected: 0, // REJOUER par défaut — remis à 0 à chaque mort (states/endOfRun.js)
    pauseStage: "menu", // "menu" | "confirmQuit"
    confirmQuitSelected: 1, // par défaut sur NON — un Entrée accidentel ne doit pas faire perdre la partie
    helpReturnTo: MODE.MENU, // où revenir en fermant l'aide (MODE.MENU, MODE.PAUSED ou MODE.PLAYING)
    helpPage: 0, // page courante de l'écran Aide — voir states/help.js

    // Partie en cours
    score: 0,
    enemiesKilled: 0, // total partie (waveKills se réinitialise par vague) — Game Over + classement
    wave: 1,
    waveKills: 0,
    waveKillTarget: DIFFICULTY.baseWaveKills,
    intactBlink: 0, // secondes de clignotement du rappel "INTACT" après le premier coup de la vague (hud.js)
    tookDamageThisWave: false, // pour DIFFICULTY.noDamageWaveBonus — reset dans startWave, mis à true dans onPlayerHit
    grazeChain: 0, // reset dans startWave (pas startRun) — voir graze.js
    maxGrazeChain: 0, // meilleure chaîne de la partie entière — reset dans startRun (pas startWave), voir graze.js
    distanceTraveled: 0, // années-lumière, accumulé pendant PLAYING — reset dans startRun, voir DISTANCE dans config.js
    novaStock: 0, // rechargé par le graze, consommé par tryUseNova() — vide au début d'une partie (récompense à gagner)
    novaProgress: 0, // 0..1, progression vers la prochaine charge
    novaMax: 1, // recalculé dans startWave (novaMaxForWave)
    spawnTimer: 0,
    spawnInterval: DIFFICULTY.baseSpawnInterval,
    waveBreak: 0,
    waveBreakDuration: DIFFICULTY.waveBreakDuration, // mémorisé au déclenchement (normal ou bossWaveBreakDuration) pour calculer la courbe de warp
    warp: 1,
    shake: 0,
    flash: 0,
    hitStop: 0,
    banner: null,
    boss: null,
    bonusLevel: null, // niveau bonus en cours (voir bonusLevel.js) — null hors de ce niveau
    clearingScreen: false,
    controlHint: 0,
    dying: false, // séquence cinématique (ralenti) entre la mort et l'écran GAME OVER
    deathTimer: 0,
    shipIntro: false, // glissée d'entrée du vaisseau au tout début d'une partie (vague 1)
    shipIntroTimer: 0,

    // Classement
    scores: null, // null = chargement en cours ou échec (voir scoresFailed)
    scoresFailed: false,
    scoresRevealCount: 0,
    scoresRevealTimer: 0,
    leaderboardReturnTo: MODE.MENU,
    gamesPlayed: null, // total global (toutes parties) — voir states/leaderboardScreen.js

    // Crédits
    creditsScroll: 0,

    // Saisie du nom
    nameEntry: "",
  };

  // Ouvre l'aide depuis le bouton du panneau — pas forcément déjà en pause,
  // contrairement à l'entrée du menu pause. No-op sur les écrans sans retour
  // cohérent (classement, crédits...).
  function openHelp() {
    if (g.mode === MODE.MENU || g.mode === MODE.PLAYING || g.mode === MODE.PAUSED) {
      helpState.open(g, g.mode);
    }
  }

  // La scène de jeu est à l'écran : en partie, et figée derrière la pause ou GAME OVER.
  function inScene() {
    return g.mode === MODE.PLAYING || g.mode === MODE.PAUSED || g.mode === MODE.GAME_OVER;
  }

  function update(dt) {
    if (g.mode === MODE.PLAYING) playingState.update(g, engine, dt);
    else if (g.mode === MODE.PAUSED) pausedState.update(g, engine);
    else if (g.mode === MODE.GAME_OVER) endOfRunState.updateGameOver(g, engine);
    else if (g.mode === MODE.HELP) helpState.update(g, engine);
    else if (g.mode === MODE.MENU) menuState.update(g, engine, dt);
    else if (g.mode === MODE.LEADERBOARD) leaderboardScreen.update(g, engine, dt);
    else if (g.mode === MODE.CREDITS) creditsState.update(g, engine, dt);
    // MODE.NAME_ENTRY : piloté par les événements DOM du champ caché (voir main.js)

    // Les étoiles défilent sur les écrans-menus. En partie, playingState.update()
    // s'en charge (avec le warp) ; en pause et sur GAME OVER, la scène reste figée.
    if (!inScene()) {
      // Jamais de trou noir au menu principal (voir allowBlackhole dans stars.js).
      updateStarfield(starfield, dt, 1, g.mode !== MODE.MENU);
      // Le décor du boss ne suit pas le joueur hors de la partie (l'aide, elle,
      // peut s'ouvrir en plein combat).
      if (g.mode !== MODE.HELP) starfield.deathStar = null;
    }

    // Une touche non consommée par l'état courant ne doit pas fuiter vers
    // l'état suivant — nettoyage en fin de frame, après que les handlers
    // ci-dessus aient pu la lire.
    clearJustPressed(input);
  }

  // --- Rendu ---

  function draw(ctx) {
    ctx.save();
    ctx.fillStyle = inScene() ? playingState.zonePalette(g) : PALETTE.bgDeep;
    ctx.fillRect(0, 0, RES_W, RES_H);

    // Tremblement en partie seulement : g.shake ne décroît que là (playing.js).
    if (g.shake > 0 && g.mode === MODE.PLAYING) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    }

    // Même champ d'étoiles pour tous les écrans ; étiré par le warp dans la scène de jeu.
    drawStarfield(ctx, starfield, inScene() ? g.warp : 1);

    if (inScene()) {
      playingState.drawScene(ctx, g, engine);
      if (g.mode === MODE.PAUSED) {
        pausedState.draw(ctx, g);
      } else if (g.mode === MODE.GAME_OVER) {
        endOfRunState.drawGameOverOverlay(ctx, g);
      }
    } else if (g.mode === MODE.MENU) {
      menuState.draw(ctx, g);
    } else if (g.mode === MODE.HELP) {
      helpState.draw(ctx, g);
    } else if (g.mode === MODE.LEADERBOARD) {
      leaderboardScreen.draw(ctx, g);
    } else if (g.mode === MODE.CREDITS) {
      creditsState.draw(ctx, g);
    } else if (g.mode === MODE.NAME_ENTRY) {
      endOfRunState.drawNameEntry(ctx, g);
    }

    ctx.restore();
  }

  // Pause forcée depuis l'extérieur (onglet en arrière-plan, main.js) — no-op hors partie.
  function pause() {
    if (g.mode === MODE.PLAYING) playingState.pause(g);
  }

  function handleTap(x, y) {
    if (g.mode === MODE.MENU) {
      menuState.handleTap(g, engine, x, y);
    } else if (g.mode === MODE.PAUSED) {
      pausedState.handleTap(g, x, y);
    } else if (g.mode === MODE.HELP) {
      helpState.handleTap(g, x, y);
    } else if (g.mode === MODE.GAME_OVER) {
      endOfRunState.handleTapGameOver(g, engine, x, y);
    } else if (g.mode === MODE.LEADERBOARD) {
      leaderboardScreen.handleTap(g);
    } else if (g.mode === MODE.CREDITS) {
      creditsState.handleTap(g);
    } else if (g.mode === MODE.NAME_ENTRY) {
      endOfRunState.handleTapNameEntry(g, engine, x, y);
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
    // Bonus actif, bouclier, bonus au sol, boss et ses tirs : lus par la suite e2e (e2e/tests/helpers.js).
    get buffType() {
      return player.buff ? player.buff.type : null;
    },
    get shield() {
      return player.shield;
    },
    get powerupsOnScreen() {
      return powerups.items.filter((p) => p.active).map((p) => ({ x: p.x, y: p.y }));
    },
    get bossState() {
      if (!g.boss) return null;
      const b = g.boss;
      const weakPoints = b.weakPoints.filter((p) => !p.destroyed).map((p) => ({ x: b.x + p.ox, y: b.y + p.oy }));
      return { arrived: b.arrived, weakPoints };
    },
    get bossBulletsOnScreen() {
      const bossColors = [PALETTE.bulletBossDirect, PALETTE.bulletBossCircular];
      return projectiles.enemy.items.filter((b) => b.active && bossColors.includes(b.colorOverride)).length;
    },
    // Résumé de la partie qui vient de se terminer — seule source pour la
    // carte de partage (main.js/shareCard.js), pas de champs dupliqués ailleurs.
    getRunSummary() {
      return {
        score: g.score,
        wave: g.wave,
        kills: g.enemiesKilled,
        maxGrazeChain: g.maxGrazeChain,
        distanceTraveled: g.distanceTraveled,
      };
    },
    update,
    draw,
    handleTap,
    pause,
    openHelp,
    setNameEntryText(text) {
      endOfRunState.setNameEntryText(g, text);
    },
    confirmNameEntry: () => endOfRunState.confirmNameEntry(g, engine),
  };
}
