// Point d'entrée : bootstrapping (canvas, entrées, audio) + boucle
// requestAnimationFrame avec delta-time borné.
import { RES_W, RES_H, STORAGE_KEYS } from "./config.js";
import { createInput, canvasToLogical } from "./input.js";
import { AudioEngine } from "./audio/sfx.js";
import { MusicPlayer } from "./audio/music.js";
import { createGame } from "./game.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
canvas.width = RES_W;
canvas.height = RES_H;
// Sans ça, drawImage (sprites + halo agrandi) est lissé par défaut : à cette
// résolution interne minuscule, le flou rend les vaisseaux/ennemis en blobs
// informes avant même la mise à l'échelle CSS "pixelated".
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

const input = createInput(canvas);
const audio = new AudioEngine();
const music = new MusicPlayer(audio.ctx); // même AudioContext que les bruitages — voir audio/music.js

const game = createGame({ input, audio, music, nameInputEl });

// Exports simples (pas de window.*) uniquement pour la suite e2e (e2e/) :
// un test Playwright peut faire `await import("/js/main.js")` et retrouver
// ces mêmes instances (les modules ES sont mis en cache par URL — un import
// dynamique déclenché depuis le test récupère le même module déjà évalué,
// pas une seconde copie), puis idem pour `await import("/js/config.js")`
// afin de modifier des constantes (taux de drop, difficulté...) le temps
// d'un test. Rien n'est posé sur `window` : aucune trace supplémentaire
// dans ce qui est livré, contrairement à un ancien point d'accès de debug.
export { music, audio };

// --- Redimensionnement responsive : on garde le ratio 480x270, agrandi au
// maximum dans la fenêtre, rendu net grâce à `image-rendering: pixelated`
// (voir css/style.css) plutôt qu'un lissage flou.
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

// --- Audio : un seul démarrage, déclenché par le premier geste utilisateur
// (règle des navigateurs pour l'AudioContext). Le flux musical ne s'arrête
// plus jamais ensuite, quel que soit l'écran affiché.
function beginAudio() {
  audio.ensure(); // reprend le contexte partagé (SFX + musique, voir audio/music.js)
  audio.setMuted(music.muted);
  music.start();
}
window.addEventListener("pointerdown", beginAudio, { once: true });
window.addEventListener("keydown", beginAudio, { once: true });

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

// --- Saisie du nom (écran de fin de partie) : un vrai <input> caché reçoit
// le focus pour déclencher le clavier virtuel mobile, sa valeur est
// répercutée dans le jeu à chaque frappe.
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

// --- Pause automatique quand l'onglet/app passe en arrière-plan (surtout
// mobile : changer d'app en pleine partie ne doit pas faire perdre de vies
// pendant l'absence).
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.pause();
});

// --- Boucle principale ---
let lastTime = 0;
function loop(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTime) / 1000 || 0);
  lastTime = timestamp;
  game.update(dt);
  game.draw(ctx);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
