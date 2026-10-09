// Point d'entrée : crée le jeu, branche les boutons et les touches de la page,
// puis lance la boucle d'animation.
import { STORAGE_KEYS, GAME_SPEEDS, VERSION } from "./config.js";
import { createRenderer } from "./renderer.js";
import { createInput, canvasToLogical } from "./input.js";
import { AudioEngine } from "./audio/sfx.js";
import { MusicPlayer } from "./audio/music.js";
import { createGame } from "./game.js";
import { createShareCardCanvas } from "./shareCard.js";
import { loadItem, saveItem } from "./storage.js";
import { initConsent } from "./consent.js";
import { t, lang, LANGS, nextLangCode, nextLang, translateDom } from "./i18n.js";

const $ = (id) => document.getElementById(id);

const canvas = $("game-canvas");
const renderer = createRenderer(canvas);
const nameInputEl = $("name-input");

const input = createInput(canvas);
const audio = new AudioEngine();
const music = new MusicPlayer(audio.ctx); // même AudioContext que les bruitages — voir audio/music.js
const game = createGame({ input, audio, music, nameInputEl });

// Pour la suite e2e : un test peut faire `await import("/js/main.js")` et
// retrouver ces mêmes instances (un module n'est évalué qu'une fois par page).
export { music, game };

translateDom();
$("version-label").textContent = `v${VERSION}`;
// La page de confidentialité contient les deux langues : le lien mène à la bonne.
for (const link of document.querySelectorAll(".privacy-link")) link.href = `privacy.html#${lang}`;
// Bouton de langue : il montre les drapeaux de la langue proposée, la suivante.
const langBtn = $("lang-btn");
for (const flag of LANGS[nextLangCode]["lang.flags"].split(" ")) {
  const span = document.createElement("span");
  span.className = `flag flag-${flag}`;
  langBtn.append(span);
}
langBtn.addEventListener("click", nextLang);
initConsent();

// --- Audio : repris à chaque geste, pas seulement au premier. Le navigateur
// n'accepte resume() que depuis un vrai geste et peut suspendre le contexte en
// cours de partie. ensure() et start() sont sans effet s'il n'y a rien à faire.
function beginAudio() {
  audio.ensure();
  audio.setMuted(music.muted);
  music.start();
}
window.addEventListener("pointerdown", beginAudio);
window.addEventListener("keydown", beginAudio);

// --- Tap ou clic dans le jeu (menus), en coordonnées logiques. Il doit avoir
// commencé sur l'écran courant : relâcher le tir à l'apparition de GAME OVER
// ne doit pas choisir une option.
let pointerDownMode = null;
canvas.addEventListener("pointerdown", () => (pointerDownMode = game.mode));
canvas.addEventListener("pointerup", (e) => {
  if (pointerDownMode !== game.mode) return;
  const p = canvasToLogical(canvas, e.clientX, e.clientY);
  game.handleTap(p.x, p.y);
});

// --- Un bouton, une case ou un curseur cliqué à la souris garde le focus
// clavier : Espace ou Entrée, des touches du jeu, l'actionneraient de nouveau.
// Le focus est donc rendu après chaque clic (au champ du pseudo pendant sa
// saisie). e.detail vaut 0 pour un "clic" venu du clavier, laissé tel quel.
$("game-container").addEventListener("click", (e) => {
  if (e.detail === 0) return;
  if (game.mode === game.MODE.NAME_ENTRY) nameInputEl.focus();
  else document.activeElement.blur();
});

// --- Panneau de réglages (bas gauche), rétractable ; #mc-toggle reste visible.
// Sans préférence mémorisée, il est replié sur un écran bas (téléphone en
// paysage), où il recouvrirait le jeu.
const mcWrap = $("mc-wrap");
const mcToggle = $("mc-toggle");
const storedCollapsed = loadItem(STORAGE_KEYS.panelCollapsed);
let panelCollapsed = storedCollapsed === null ? window.innerHeight < 500 : storedCollapsed === "1";
function applyPanelState() {
  mcWrap.classList.toggle("collapsed", panelCollapsed);
  mcToggle.textContent = panelCollapsed ? "▶" : "◀";
}
applyPanelState();
mcToggle.addEventListener("click", () => {
  panelCollapsed = !panelCollapsed;
  applyPanelState();
  saveItem(STORAGE_KEYS.panelCollapsed, panelCollapsed ? "1" : "0");
});

// Sans effet hors partie.
$("pause-btn").addEventListener("click", () => game.pause());

// --- Musique : stop/lecture, piste suivante, volume.
const musicStopBtn = $("music-stop-btn");
const musicVolumeEl = $("music-volume");
musicStopBtn.addEventListener("click", () => {
  music.toggleStop();
  musicStopBtn.textContent = music.paused ? "▶" : "⏹";
});
$("music-next-btn").addEventListener("click", () => music.next());
musicVolumeEl.value = String(Math.round(music.volume * 100));
musicVolumeEl.addEventListener("input", () => music.setVolume(Number(musicVolumeEl.value) / 100));

// --- Volume des bruitages, indépendant de celui de la musique.
const sfxVolumeEl = $("sfx-volume");
sfxVolumeEl.value = String(Math.round(audio.masterVolume * 100));
sfxVolumeEl.addEventListener("input", () => audio.setMasterVolume(Number(sfxVolumeEl.value) / 100));

// --- Tir automatique (case à cocher), actif par défaut ; décoché, il faut maintenir le clic.
const autoFireToggle = $("autofire-toggle");
autoFireToggle.checked = loadItem(STORAGE_KEYS.autoFire) !== "0";
input.autoFire = autoFireToggle.checked;
autoFireToggle.addEventListener("change", () => {
  input.autoFire = autoFireToggle.checked;
  saveItem(STORAGE_KEYS.autoFire, autoFireToggle.checked ? "1" : "0");
});

$("help-btn").addEventListener("click", () => game.openHelp());

// --- Plein écran sur #game-container (pas le canvas seul : les boutons posés
// par-dessus doivent rester visibles). Bouton masqué si le navigateur n'a pas
// l'API (iPhone).
const fullscreenBtn = $("fullscreen-btn");
if (document.fullscreenEnabled) {
  fullscreenBtn.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else $("game-container").requestFullscreen().catch(() => {}); // refus du navigateur : rien à faire
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreenBtn.textContent = t(document.fullscreenElement ? "panel.fullscreen.exit" : "panel.fullscreen");
  });
} else {
  fullscreenBtn.parentElement.classList.add("hidden");
}

// --- Vitesse du jeu (x1, x1.5, x2 au clic) : multiplie le temps de jeu écoulé
// à chaque image (voir loop). Tout le jeu accélère du même facteur ; la musique
// et les bruitages gardent leur vitesse.
const speedBtn = $("speed-btn");
const storedSpeed = parseFloat(loadItem(STORAGE_KEYS.gameSpeed));
let gameSpeed = GAME_SPEEDS.includes(storedSpeed) ? storedSpeed : 1;
speedBtn.textContent = `x${gameSpeed}`;
speedBtn.addEventListener("click", () => {
  gameSpeed = GAME_SPEEDS[(GAME_SPEEDS.indexOf(gameSpeed) + 1) % GAME_SPEEDS.length];
  speedBtn.textContent = `x${gameSpeed}`;
  saveItem(STORAGE_KEYS.gameSpeed, gameSpeed);
});

// --- Bouton NOVA (tactile) : lu par le jeu comme une touche (states/playing.js).
const novaBtn = $("nova-btn");
novaBtn.addEventListener("click", () => input.justPressed.add("NovaTrigger"));

// --- Bouton Partager (fin de partie) : image PNG du résultat (shareCard.js),
// toujours téléchargée, et copiée dans le presse-papier si le navigateur le permet.
const shareBtn = $("share-btn");
shareBtn.addEventListener("click", async () => {
  const card = createShareCardCanvas(game.getRunSummary());
  const blob = await new Promise((resolve) => card.toBlob(resolve, "image/png"));
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "arcadepipe-score.png";
  link.click();
  // Libérée après un délai : révoquée tout de suite, certains navigateurs annulent le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    shareBtn.textContent = t("share.done");
    setTimeout(() => (shareBtn.textContent = t("share.button")), 2000);
  } catch {
    /* copie d'image indisponible sur ce navigateur : le téléchargement a déjà eu lieu */
  }
});

// --- Filtre rétro (case à cocher) : lignes de balayage par-dessus le jeu, actif par défaut.
const crtToggle = $("crt-toggle");
crtToggle.checked = loadItem(STORAGE_KEYS.crt) !== "0";
$("crt-overlay").classList.toggle("hidden", !crtToggle.checked);
crtToggle.addEventListener("change", () => {
  $("crt-overlay").classList.toggle("hidden", !crtToggle.checked);
  saveItem(STORAGE_KEYS.crt, crtToggle.checked ? "1" : "0");
});

// --- Touche M (son) et Konami code. e.key (la lettre) et non e.code (la
// position de la touche) : M et A ne sont pas au même endroit sur un clavier AZERTY.
window.addEventListener("keydown", (e) => {
  const key = (e.key || "").toLowerCase();
  if (game.mode === game.MODE.NAME_ENTRY) {
    // Les lettres sont le pseudo ; seule Entrée valide.
    if (key === "enter" && !e.repeat) game.confirmNameEntry();
    return;
  }
  if (key === "m") audio.setMuted(music.toggleMuted());
  checkKonami(key);
});

// --- Konami code : un jingle et le canvas qui penche (konami-tilt, css/style.css). Aucun effet de jeu.
const KONAMI_SEQUENCE = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
let lastKeys = [];
function checkKonami(key) {
  lastKeys = [...lastKeys, key].slice(-KONAMI_SEQUENCE.length);
  if (lastKeys.join() !== KONAMI_SEQUENCE.join()) return;
  lastKeys = [];
  audio.playKonami();
  // Relance l'animation même si elle est en cours : lire offsetWidth force le
  // navigateur à prendre en compte le retrait de la classe avant son retour.
  canvas.classList.remove("konami-tilt");
  void canvas.offsetWidth;
  canvas.classList.add("konami-tilt");
}

// --- Saisie du pseudo : un champ caché reçoit la frappe (et ouvre le clavier
// virtuel sur mobile) ; le jeu affiche sa valeur, nettoyée, et la lui renvoie.
nameInputEl.addEventListener("input", () => (nameInputEl.value = game.setNameEntryText(nameInputEl.value)));

// --- Onglet en arrière-plan : le jeu se met en pause (pas de vie perdue
// pendant l'absence) et la musique s'interrompt. Au retour, reprise du contexte
// audio, que certains navigateurs suspendent sans jamais le relancer.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.pause();
  else audio.ensure();
  music.setInBackground(document.hidden);
});

// --- Boucle principale.
const MAX_STEP = 1 / 60;
let lastTime = 0;
function loop(timestamp) {
  // Temps écoulé borné à 50 ms : après un onglet gelé, le jeu ne fait pas un bond.
  const dt = Math.min(0.05, (timestamp - lastTime) / 1000 || 0);
  lastTime = timestamp;
  // Avancé par pas de 1/60 s au plus : d'un seul grand pas (vitesse x2, image
  // en retard), un tir sauterait par-dessus un ennemi sans le toucher.
  for (let left = dt * gameSpeed; left > 0.0001; left -= MAX_STEP) {
    game.update(Math.min(left, MAX_STEP));
  }
  renderer.applyScale();
  game.draw(renderer.ctx);
  const { mode, MODE } = game;
  novaBtn.classList.toggle("hidden", !(mode === MODE.PLAYING && game.novaStock > 0 && !game.inBonusLevel));
  shareBtn.classList.toggle("hidden", mode !== MODE.GAME_OVER && mode !== MODE.NAME_ENTRY);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
