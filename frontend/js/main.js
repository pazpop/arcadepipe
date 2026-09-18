// Point d'entrée : bootstrapping (canvas, entrées, audio) + boucle
// requestAnimationFrame avec delta-time borné.
import { RES_W, RES_H, STORAGE_KEYS, GAME_SPEEDS, VERSION } from "./config.js";
import { createInput, canvasToLogical } from "./input.js";
import { AudioEngine } from "./audio/sfx.js";
import { MusicPlayer } from "./audio/music.js";
import { createGame } from "./game.js";
import { createShareCardCanvas } from "./shareCard.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
canvas.width = RES_W;
canvas.height = RES_H;
// Sans ça, drawImage est lissé par défaut — à cette résolution minuscule, ça
// rend les sprites en blobs flous.
ctx.imageSmoothingEnabled = false;

const nameInputEl = document.getElementById("name-input");
const crtOverlay = document.getElementById("crt-overlay");
const musicStopBtn = document.getElementById("music-stop-btn");
const musicNextBtn = document.getElementById("music-next-btn");
const musicVolumeEl = document.getElementById("music-volume");
const pauseBtn = document.getElementById("pause-btn");
const mcWrap = document.getElementById("mc-wrap");
const mcToggle = document.getElementById("mc-toggle");
const sfxVolumeEl = document.getElementById("sfx-volume");
const autoFireToggle = document.getElementById("autofire-toggle");
const helpBtn = document.getElementById("help-btn");
const speedBtn = document.getElementById("speed-btn");
const novaBtn = document.getElementById("nova-btn");
const shareBtn = document.getElementById("share-btn");
const versionLabel = document.getElementById("version-label");
if (versionLabel) versionLabel.textContent = `v${VERSION}`;

const input = createInput(canvas);
const audio = new AudioEngine();
const music = new MusicPlayer(audio.ctx); // même AudioContext que les bruitages — voir audio/music.js

const game = createGame({ input, audio, music, nameInputEl });

// Exports pour la suite e2e (e2e/) : un test Playwright peut faire
// `await import("/js/main.js")` et retrouver ces mêmes instances (modules ES
// mis en cache par URL). Rien sur `window`, pas de trace en prod.
export { music, audio };

// --- Redimensionnement responsive : ratio 480x270 gardé, agrandi au max, net
// grâce à `image-rendering: pixelated` (css/style.css).
function resizeCanvas() {
  const ratio = RES_W / RES_H;
  let w = window.innerWidth;
  let h = window.innerHeight;
  if (w / h > ratio) {
    w = h * ratio;
  } else {
    h = w / ratio;
  }
  canvas.style.width = `${Math.floor(w)}px`;
  canvas.style.height = `${Math.floor(h)}px`;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- Audio : (re)pris à CHAQUE geste utilisateur, pas seulement le premier
// (règle des navigateurs pour l'AudioContext — resume() ne peut réussir que
// depuis un vrai geste, jamais depuis la boucle d'animation, voir
// watchAudioContext plus bas). Si le navigateur suspend le contexte en cours
// de partie (économie d'énergie), il faut un nouveau geste pour le relancer ;
// en "Tir automatique", le joueur ne clique jamais sur le canvas en jouant,
// donc un seul geste initial ne suffirait pas. audio.ensure()/music.start()
// sont tous deux idempotents (no-op au-delà du premier appel utile), donc
// rien ne coûte à les rappeler à chaque geste plutôt que de distinguer
// "premier geste" (démarre tout) et "gestes suivants" (juste un resume).
function beginAudio() {
  audio.ensure(); // reprend le contexte partagé (SFX + musique, voir audio/music.js)
  audio.setMuted(music.muted);
  music.start(); // no-op si déjà démarré (voir music.js)
}
window.addEventListener("pointerdown", beginAudio);
window.addEventListener("keydown", beginAudio);

// --- Tap/clic générique (menu, classement, crédits) — converti en
// coordonnées logiques internes (480x270) avant d'être transmis au jeu.
canvas.addEventListener("pointerup", (e) => {
  const p = canvasToLogical(canvas, e.clientX, e.clientY);
  game.handleTap(p.x, p.y);
});

// --- Panneau rétractable (bas gauche) : #mc-toggle reste toujours visible,
// même replié — préférence persistée. ---
if (mcWrap && mcToggle) {
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(STORAGE_KEYS.panelCollapsed) === "1";
  } catch {
    /* stockage indisponible — pas bloquant */
  }
  function applyPanelState() {
    mcWrap.classList.toggle("collapsed", collapsed);
    mcToggle.textContent = collapsed ? "▶" : "◀";
  }
  applyPanelState();
  mcToggle.addEventListener("click", () => {
    collapsed = !collapsed;
    applyPanelState();
    try {
      localStorage.setItem(STORAGE_KEYS.panelCollapsed, collapsed ? "1" : "0");
    } catch {
      /* stockage indisponible — pas bloquant */
    }
  });
}

// --- Bouton pause (mobile — pas d'équivalent tactile à Échap/P) ---
if (pauseBtn) {
  pauseBtn.addEventListener("click", () => {
    audio.ensure();
    game.pause(); // no-op si une partie n'est pas en cours (déjà en pause, au menu...)
  });
}

// --- Contrôles musique (stop/lecture, piste suivante, volume) ---
if (musicVolumeEl) musicVolumeEl.value = String(Math.round(music.volume * 100));
if (musicStopBtn) {
  musicStopBtn.textContent = music.paused ? "▶" : "⏹";
  musicStopBtn.addEventListener("click", () => {
    audio.ensure(); // au cas où c'est le tout premier geste de la session
    music.toggleStop();
    musicStopBtn.textContent = music.paused ? "▶" : "⏹";
  });
}
if (musicNextBtn) {
  musicNextBtn.addEventListener("click", () => {
    audio.ensure();
    music.next();
  });
}
if (musicVolumeEl) {
  musicVolumeEl.addEventListener("input", () => {
    music.setVolume(Number(musicVolumeEl.value) / 100);
  });
}

// --- Volume des bruitages (indépendant de celui de la musique) ---
if (sfxVolumeEl) {
  sfxVolumeEl.value = String(Math.round(audio.masterVolume * 100));
  sfxVolumeEl.addEventListener("input", () => {
    audio.setMasterVolume(Number(sfxVolumeEl.value) / 100);
  });
}

// --- Tir manuel (défaut) vs automatique (case à cocher, préférence persistée) ---
if (autoFireToggle) {
  let storedAutoFire = false;
  try {
    storedAutoFire = localStorage.getItem(STORAGE_KEYS.autoFire) === "1";
  } catch {
    /* stockage indisponible — pas bloquant */
  }
  autoFireToggle.checked = storedAutoFire;
  input.autoFire = storedAutoFire;
  autoFireToggle.addEventListener("change", () => {
    input.autoFire = autoFireToggle.checked;
    try {
      localStorage.setItem(STORAGE_KEYS.autoFire, autoFireToggle.checked ? "1" : "0");
    } catch {
      /* stockage indisponible — pas bloquant */
    }
  });
}

// --- Bouton Aide (panneau bas gauche) : ouvre l'écran d'aide directement,
// depuis le menu principal ou en pleine partie. ---
if (helpBtn) {
  helpBtn.addEventListener("click", () => {
    audio.ensure();
    game.openHelp();
  });
}

// --- Vitesse du jeu (x1/x1.5/x2, cycle au clic) : multiplie le delta-time
// envoyé à game.update() ci-dessous — accélère tout ce qui dépend du temps
// de façon uniforme (déplacement, cadence de tir, apparition des ennemis...),
// donc la difficulté relative ne change pas. La musique/les bruitages tournent
// sur leur propre horloge audio réelle et ne sont jamais affectés.
let gameSpeed = 1;
if (speedBtn) {
  try {
    const stored = parseFloat(localStorage.getItem(STORAGE_KEYS.gameSpeed));
    if (GAME_SPEEDS.includes(stored)) gameSpeed = stored;
  } catch {
    /* stockage indisponible — pas bloquant */
  }
  speedBtn.textContent = `x${gameSpeed}`;
  speedBtn.addEventListener("click", () => {
    const idx = GAME_SPEEDS.indexOf(gameSpeed);
    gameSpeed = GAME_SPEEDS[(idx + 1) % GAME_SPEEDS.length];
    speedBtn.textContent = `x${gameSpeed}`;
    try {
      localStorage.setItem(STORAGE_KEYS.gameSpeed, String(gameSpeed));
    } catch {
      /* stockage indisponible — pas bloquant */
    }
  });
}

// --- Bouton NOVA (tactile) : pose un jeton générique dans input.justPressed,
// consommé exactement comme une touche clavier (voir states/playing.js). ---
if (novaBtn) {
  novaBtn.addEventListener("click", () => {
    audio.ensure();
    input.justPressed.add("NovaTrigger");
  });
}

// --- Bouton "Partager" (visible juste après la fin d'une partie, voir
// loop() plus bas) : image PNG carrée (score/vague/kills/meilleure chaîne
// de frôlements, voir shareCard.js) — copiée dans le presse-papier quand le
// navigateur le permet, TOUJOURS aussi proposée en téléchargement (support
// du presse-papier image inégal d'un navigateur à l'autre, le téléchargement
// marche partout). Le clic est le geste utilisateur exigé par l'API Clipboard.
if (shareBtn) {
  shareBtn.addEventListener("click", async () => {
    const canvas2 = createShareCardCanvas(game.getRunSummary());
    const blob = await new Promise((resolve) => canvas2.toBlob(resolve, "image/png"));
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arcadepipe-score.png";
    a.click();
    URL.revokeObjectURL(url);

    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      const original = shareBtn.textContent;
      shareBtn.textContent = "✅ Copiée + téléchargée";
      setTimeout(() => (shareBtn.textContent = original), 2000);
    } catch {
      /* Clipboard API image indisponible sur ce navigateur — le
         téléchargement ci-dessus a déjà eu lieu, rien de plus à faire. */
    }
  });
}

// --- Konami code (easter egg, aucun effet de jeu — juste un son + un tilt
// visuel du canvas, voir konami-tilt dans css/style.css) ---
const KONAMI_SEQUENCE = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "KeyB", "KeyA",
];
let konamiProgress = 0;
window.addEventListener("keydown", (e) => {
  if (e.code === KONAMI_SEQUENCE[konamiProgress]) {
    konamiProgress++;
  } else {
    // Touche inattendue : on recommence à zéro, sauf si elle correspond
    // justement à la première touche de la séquence (permet d'enchaîner
    // deux tentatives sans devoir marquer une pause entre les deux).
    konamiProgress = e.code === KONAMI_SEQUENCE[0] ? 1 : 0;
  }
  if (konamiProgress === KONAMI_SEQUENCE.length) {
    konamiProgress = 0;
    audio.ensure();
    audio.playKonami();
    // Force un redémarrage propre de l'animation même si le code est refait
    // avant la fin de la précédente — retirer/rajouter la classe seule ne
    // suffit pas (le navigateur ne "voit" pas de changement sans un reflow
    // forcé entre les deux, ici via la simple lecture de offsetWidth).
    canvas.classList.remove("konami-tilt");
    void canvas.offsetWidth;
    canvas.classList.add("konami-tilt");
  }
});

// --- Mute (M) et bascule CRT (C) ---
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyM") {
    const muted = music.toggleMuted();
    audio.setMuted(muted);
  } else if (e.code === "KeyC") {
    toggleCrt();
  }
});

function readCrtEnabled() {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.crt);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}
function applyCrt(enabled) {
  if (crtOverlay) crtOverlay.classList.toggle("hidden", !enabled);
}
function toggleCrt() {
  const enabled = !readCrtEnabled();
  try {
    localStorage.setItem(STORAGE_KEYS.crt, enabled ? "1" : "0");
  } catch {
    /* stockage indisponible — pas bloquant */
  }
  applyCrt(enabled);
}
applyCrt(readCrtEnabled());

// --- Saisie du nom : un <input> caché reçoit le focus (clavier virtuel
// mobile), sa valeur est répercutée dans le jeu à chaque frappe.
if (nameInputEl) {
  nameInputEl.addEventListener("input", () => {
    game.setNameEntryText(nameInputEl.value);
  });
  nameInputEl.addEventListener("keydown", (e) => {
    if (e.code === "Enter") game.confirmNameEntry();
  });
}
window.addEventListener("keydown", (e) => {
  if (game.mode === game.MODE.NAME_ENTRY && e.code === "Enter" && document.activeElement !== nameInputEl) {
    game.confirmNameEntry();
  }
});

// --- Pause auto quand l'onglet/app passe en arrière-plan (mobile : ne pas
// perdre de vies pendant l'absence) + reprise de l'AudioContext au retour.
// Certains navigateurs suspendent le contexte audio après un moment en
// arrière-plan (économie d'énergie) sans jamais le reprendre eux-mêmes —
// sans ce resume() explicite, revenir sur l'onglet laissait la musique
// silencieuse en permanence tant qu'aucun contrôle du panneau n'était touché.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    game.pause();
  } else {
    audio.ensure();
  }
});

// --- Filet de sécurité supplémentaire : détection de suspension de l'AudioContext.
// Le resume() sur visibilitychange (ci-dessus) ne couvre que le cas "onglet
// caché puis revisible" — certains navigateurs/réglages d'économie d'énergie
// suspendent le contexte après un moment d'inactivité audio perçue MÊME
// onglet actif au premier plan, sans qu'aucun événement ne le signale. Coût
// négligeable (une lecture de propriété par frame) pour ne plus dépendre
// d'un déclencheur précis.
//
// Ne PAS appeler resume() ici : depuis la boucle d'animation, ce n'est
// jamais un vrai geste utilisateur, donc ça échoue systématiquement (le
// navigateur le refuse) — appeler resume() en boucle ici ne faisait que
// spammer la console à chaque frame sans jamais réussir. La vraie reprise
// se fait via les écouteurs pointerdown/keydown permanents ci-dessus ; ici
// on se contente de logguer UNE FOIS par épisode de suspension (`warned`
// évite de reloguer tant que ça reste suspendu).
let warnedSuspended = false;
function watchAudioContext() {
  const suspended = audio.ctx.state === "suspended" && music.started;
  if (suspended && !warnedSuspended) {
    warnedSuspended = true;
    console.warn("[audio] AudioContext suspendu de façon inattendue (onglet actif) — un prochain clic/touche le relancera.");
  } else if (!suspended) {
    warnedSuspended = false;
  }
}

// --- Boucle principale ---
let lastTime = 0;
function loop(timestamp) {
  const realDt = Math.min(0.05, (timestamp - lastTime) / 1000 || 0); // borné avant le multiplicateur de vitesse, pas après
  lastTime = timestamp;
  game.update(realDt * gameSpeed);
  game.draw(ctx);
  watchAudioContext();
  if (novaBtn) {
    novaBtn.classList.toggle("hidden", !(game.mode === game.MODE.PLAYING && game.novaStock > 0 && !game.inBonusLevel));
  }
  if (shareBtn) {
    // GAME_OVER (juste après la mort) et NAME_ENTRY (pendant/après la
    // saisie du pseudo) : la fenêtre naturelle où le joueur vient de voir
    // son résultat, avant de repartir vers le classement/le menu.
    shareBtn.classList.toggle("hidden", !(game.mode === game.MODE.GAME_OVER || game.mode === game.MODE.NAME_ENTRY));
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
