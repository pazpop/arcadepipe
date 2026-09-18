// Musique : playlist de fichiers tracker .xm via chiptune3.js (AudioWorklet).
// Le flux ne se recrée jamais en changeant d'écran — seul un changement de
// piste ou stop/play y touche.
import { AUDIO, STORAGE_KEYS } from "../config.js";
import { ChiptuneJsPlayer } from "../../lib/chiptune3.js";
import { loadItem, loadUnitFloat, saveItem } from "../storage.js";

export class MusicPlayer {
  // `audioContext` partagé avec le moteur SFX plutôt qu'un second créé par
  // chiptune3 — un contexte jamais repris dans un geste utilisateur reste
  // "verrouillé" sur iOS.
  constructor(audioContext) {
    // repeatCount 0 : une piste ne boucle pas, on enchaîne via onEnded.
    this.player = new ChiptuneJsPlayer({
      repeatCount: 0,
      stereoSeparation: 100,
      interpolationFilter: 4, // cubique (openmpt : 1=aucun, 2=linéaire, 4=cubique, 8=sinc)
      context: audioContext,
    });
    // Avec un contexte externe, chiptune3 ne connecte pas sa sortie : sans cette ligne, silence.
    this.player.gain.connect(audioContext.destination);
    // Ignoré pendant un chargement : un 'end' répété ne doit jamais relancer un
    // fetch par message (voir docs/audio-saga.md, 6e round).
    this.player.onEnded(() => {
      if (!this._loading) this.playRandom();
    });
    // Module invalide côté worklet ("ptr") : autre piste, après un délai —
    // jamais immédiatement, sinon boucle fetch -> échec -> fetch en rafale.
    this.player.onError((e) => {
      console.warn("[music] onError", e);
      if (e && e.type !== "Load") {
        this._loadRetries += 1;
        const delay = Math.min(10000, 2000 * this._loadRetries);
        setTimeout(() => this.playRandom(), delay);
      }
    });
    this.started = false;
    this.paused = false;
    this.muted = loadItem(STORAGE_KEYS.muted) === "1";
    this.volume = loadUnitFloat(STORAGE_KEYS.volume, AUDIO.masterVolume);
    const savedTrack = parseInt(loadItem(STORAGE_KEYS.track), 10);
    this.trackIndex = Number.isFinite(savedTrack) ? savedTrack : 0;
    if (this.trackIndex < 0 || this.trackIndex >= AUDIO.tracks.length) this.trackIndex = 0;
    // Incrémenté à chaque _loadCurrent() : une réponse réseau périmée est ignorée.
    this._loadToken = 0;
    // Échecs consécutifs, remis à 0 dès qu'un chargement réussit.
    this._loadRetries = 0;
    // true du lancement d'un chargement jusqu'à son aboutissement.
    this._loading = false;
  }

  _applyGain() {
    this.player.setVol(this.muted ? 0 : this.volume);
  }

  get currentTrack() {
    return AUDIO.tracks[this.trackIndex];
  }

  // fetch fait ici (pas player.load()) pour ignorer une réponse périmée (jeton)
  // et couper le volume le temps de la bascule (évite le clic).
  _loadCurrent() {
    const token = ++this._loadToken;
    this._loading = true;
    const track = this.currentTrack;
    this.paused = false;

    const g = this.player.gain.gain;
    const now = this.player.context.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 0.02);

    fetch(track.file)
      .then((r) => {
        // fetch() ne rejette pas sur un statut HTTP d'erreur : sans ce contrôle,
        // un 429 serait passé au lecteur comme un fichier audio.
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (token !== this._loadToken) return; // supplantée par une piste demandée depuis
        this._loadRetries = 0;
        this._loading = false;
        this.player.play(buf);
        const target = this.muted ? 0 : this.volume;
        const t = this.player.context.currentTime;
        g.cancelScheduledValues(t);
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(target, t + 0.03);
      })
      .catch((err) => {
        if (token !== this._loadToken) return; // supplantée, la piste plus récente gère le volume
        console.warn("[music] échec de chargement", track.file, err);
        // Le fondu de sortie a déjà coupé le son : on remonte le volume.
        const target = this.muted ? 0 : this.volume;
        const t = this.player.context.currentTime;
        g.cancelScheduledValues(t);
        g.linearRampToValueAtTime(target, t + 0.03);
        // Nouvelle tentative différée (2 s, 4 s, ... plafonné à 10 s), sans limite
        // de nombre : une panne longue doit se résorber seule (voir docs/audio-saga.md).
        this._loadRetries += 1;
        const delay = Math.min(10000, 2000 * this._loadRetries);
        setTimeout(() => {
          if (token === this._loadToken) this._loadCurrent();
        }, delay);
      });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this._loadRetries = 0; // nouvelle demande explicite, pas une relance
    this._loadCurrent();
  }

  next() {
    this.trackIndex = (this.trackIndex + 1) % AUDIO.tracks.length;
    saveItem(STORAGE_KEYS.track, this.trackIndex);
    if (this.started) {
      this._loadRetries = 0;
      this._loadCurrent();
    }
  }

  // Tirée au début de chaque partie — jamais deux fois la même piste d'affilée.
  playRandom() {
    if (AUDIO.tracks.length > 1) {
      let idx;
      do {
        idx = Math.floor(Math.random() * AUDIO.tracks.length);
      } while (idx === this.trackIndex);
      this.trackIndex = idx;
    }
    saveItem(STORAGE_KEYS.track, this.trackIndex);
    this._loadRetries = 0; // tous les points d'entrée remettent le compteur à 0
    if (this.started) this._loadCurrent();
  }

  // Bascule stop/lecture — vraie pause du moteur (pas juste volume à zéro).
  // togglePause() est un no-op silencieux tant qu'aucune piste n'est chargée.
  toggleStop() {
    if (!this.started) return;
    this.player.togglePause();
    this.paused = !this.paused;
  }

  setMuted(muted) {
    this.muted = muted;
    this._applyGain();
    saveItem(STORAGE_KEYS.muted, muted ? "1" : "0");
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this._applyGain();
    saveItem(STORAGE_KEYS.volume, this.volume);
  }
}
