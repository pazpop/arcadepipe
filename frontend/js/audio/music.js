// Musique : playlist de fichiers MP3 (AUDIO.tracks) lue par un élément <audio>,
// branché sur l'AudioContext partagé avec les bruitages.
import { AUDIO, STORAGE_KEYS } from "../config.js";
import { loadItem, loadUnitFloat, saveItem } from "../storage.js";

const FADE_S = 0.02; // fondu au changement de piste (évite le clic)
const RETRY_MAX_DELAY_MS = 10000;

export class MusicPlayer {
  // AudioContext partagé : un second contexte, jamais repris dans un geste
  // utilisateur, resterait "verrouillé" sur iOS.
  constructor(audioContext) {
    this.context = audioContext;
    this.audio = new Audio();
    this.gain = audioContext.createGain();
    audioContext.createMediaElementSource(this.audio).connect(this.gain);
    this.gain.connect(audioContext.destination);

    // Une piste ne boucle pas : fin de piste = autre piste au hasard.
    this.audio.addEventListener("ended", () => this.playRandom());
    this.audio.addEventListener("playing", () => {
      this._retries = 0;
      this._fadeTo(this._targetGain());
    });
    // Échec de chargement ou de décodage (réseau, 429...) : nouvelle tentative
    // différée (2 s, 4 s... plafonné à 10 s), jamais immédiate, sans limite de nombre.
    this.audio.addEventListener("error", () => this._retryLater());

    this._retries = 0;
    this._retryTimer = null;
    this.started = false;
    this.paused = false; // arrêtée par le joueur (bouton stop)
    this._pendingTrack = false; // piste changée pendant l'arrêt, à charger à la reprise
    this.muted = loadItem(STORAGE_KEYS.muted) === "1";
    this.volume = loadUnitFloat(STORAGE_KEYS.volume, AUDIO.masterVolume);
    const savedTrack = parseInt(loadItem(STORAGE_KEYS.track), 10);
    this.trackIndex = savedTrack >= 0 && savedTrack < AUDIO.tracks.length ? savedTrack : 0;
    this.gain.gain.value = 0; // monte au premier "playing"
  }

  _targetGain() {
    return this.muted ? 0 : this.volume;
  }

  _fadeTo(value) {
    const g = this.gain.gain;
    const now = this.context.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(value, now, FADE_S / 3);
  }

  // Fondu de sortie, puis la nouvelle source : l'élément abandonne de lui-même
  // le chargement précédent, aucune réponse périmée ne peut s'imposer.
  _load() {
    clearTimeout(this._retryTimer);
    this._retryTimer = null;
    this._fadeTo(0);
    const file = AUDIO.tracks[this.trackIndex];
    setTimeout(() => {
      this.audio.src = file;
      this.audio.play().catch(() => {}); // refus ou interruption : "error" gère les vrais échecs
    }, FADE_S * 1000);
  }

  _retryLater() {
    if (this._retryTimer) return;
    this._retries += 1;
    const delay = Math.min(RETRY_MAX_DELAY_MS, 2000 * this._retries);
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      if (!this.paused) this._load(); // musique arrêtée par le joueur entre-temps : on n'insiste pas
    }, delay);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this._load();
  }

  next() {
    this._goToTrack((this.trackIndex + 1) % AUDIO.tracks.length);
  }

  // Musique arrêtée par le joueur : la piste change, mais ne démarre qu'à la reprise.
  _goToTrack(index) {
    this.trackIndex = index;
    saveItem(STORAGE_KEYS.track, index);
    this._pendingTrack = this.paused;
    if (this.started && !this.paused) this._load();
  }

  // Tirée au début de chaque partie et en fin de piste — jamais deux fois la même d'affilée.
  playRandom() {
    let idx = this.trackIndex;
    while (AUDIO.tracks.length > 1 && idx === this.trackIndex) {
      idx = Math.floor(Math.random() * AUDIO.tracks.length);
    }
    this._goToTrack(idx);
  }

  // Bascule stop/lecture (vraie pause, pas juste le volume à zéro).
  toggleStop() {
    if (!this.started) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.audio.pause();
    } else if (this._pendingTrack) {
      this._pendingTrack = false;
      this._load();
    } else {
      this.audio.play().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
    this._fadeTo(this._targetGain());
    saveItem(STORAGE_KEYS.muted, muted ? "1" : "0");
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this._fadeTo(this._targetGain());
    saveItem(STORAGE_KEYS.volume, this.volume);
  }
}
