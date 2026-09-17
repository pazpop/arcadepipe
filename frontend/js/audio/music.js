// Musique : playlist de fichiers tracker .xm via chiptune3.js (AudioWorklet).
// Le flux ne se recrée jamais en changeant d'écran — seul un changement de
// piste ou stop/play y touche.
import { AUDIO, STORAGE_KEYS } from "../config.js";
import { ChiptuneJsPlayer } from "../../lib/chiptune3.js";

export class MusicPlayer {
  // `audioContext` partagé avec le moteur SFX (sfx.js/main.js) plutôt qu'un
  // second créé par chiptune3 — un contexte jamais repris dans le geste
  // utilisateur reste "verrouillé" côté iOS.
  constructor(audioContext) {
    // repeatCount 0 : chaque piste ne boucle plus seule, on enchaîne
    // nous-mêmes via onEnded ci-dessous pour une playlist continue.
    this.player = new ChiptuneJsPlayer({
      repeatCount: 0,
      stereoSeparation: 100,
      interpolationFilter: 4, // cubique (openmpt : 1=aucun, 2=linéaire, 4=cubique, 8=sinc) — bon compromis qualité/coût
      context: audioContext,
    });
    // Avec un contexte externe, chiptune3 ne connecte pas sa sortie lui-même
    // (`this.destination` reste `false`) — sans cette ligne, la musique jouerait en silence.
    this.player.gain.connect(audioContext.destination);
    this.player.onEnded(() => this.playRandom());
    this.started = false;
    this.paused = false;
    this.muted = this._readBool(STORAGE_KEYS.muted, false);
    this.volume = this._readFloat(STORAGE_KEYS.volume, AUDIO.masterVolume);
    this.trackIndex = this._readInt(STORAGE_KEYS.track, 0);
    if (this.trackIndex < 0 || this.trackIndex >= AUDIO.tracks.length) this.trackIndex = 0;
    // Incrémenté à chaque _loadCurrent() : start() et playRandom() peuvent
    // partir un fetch() chacun sur le même clic (game.js:startRun). Sans ce
    // jeton, la réponse arrivée en second gagnerait toujours, même périmée.
    this._loadToken = 0;
  }

  _readBool(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === "1";
    } catch {
      return fallback;
    }
  }

  _readFloat(key, fallback) {
    try {
      const v = parseFloat(localStorage.getItem(key));
      return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
    } catch {
      return fallback;
    }
  }

  _readInt(key, fallback) {
    try {
      const v = parseInt(localStorage.getItem(key), 10);
      return Number.isFinite(v) ? v : fallback;
    } catch {
      return fallback;
    }
  }

  _persist(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* stockage indisponible (navigation privée...) — pas bloquant */
    }
  }

  _applyGain() {
    this.player.setVol(this.muted ? 0 : this.volume);
  }

  get currentTrack() {
    return AUDIO.tracks[this.trackIndex];
  }

  // Fetch fait nous-mêmes (pas player.load()) pour (1) ignorer une réponse
  // périmée via _loadToken et (2) couper le volume à zéro le temps de la
  // bascule, pour éviter le clic quand libopenmpt tranche net l'ancien module.
  _loadCurrent() {
    const token = ++this._loadToken;
    const track = this.currentTrack;
    this.paused = false;

    const g = this.player.gain.gain;
    const now = this.player.context.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 0.02);

    fetch(track.file)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (token !== this._loadToken) return; // supplantée par une piste demandée depuis
        this.player.play(buf);
        const target = this.muted ? 0 : this.volume;
        const t = this.player.context.currentTime;
        g.cancelScheduledValues(t);
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(target, t + 0.03);
      })
      .catch(() => {
        if (token === this._loadToken) this.player.fireEvent("onError", { type: "Load" });
      });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this._loadCurrent();
  }

  next() {
    this.trackIndex = (this.trackIndex + 1) % AUDIO.tracks.length;
    this._persist(STORAGE_KEYS.track, String(this.trackIndex));
    if (this.started) this._loadCurrent();
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
    this._persist(STORAGE_KEYS.track, String(this.trackIndex));
    if (this.started) this._loadCurrent();
  }

  // Bascule stop/lecture — vraie pause du moteur (pas juste volume à zéro).
  // togglePause() est un no-op silencieux tant qu'aucune piste n'est chargée,
  // pas besoin de le vérifier nous-mêmes.
  toggleStop() {
    if (!this.started) return;
    this.player.togglePause();
    this.paused = !this.paused;
  }

  setMuted(muted) {
    this.muted = muted;
    this._applyGain();
    this._persist(STORAGE_KEYS.muted, muted ? "1" : "0");
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this._applyGain();
    this._persist(STORAGE_KEYS.volume, String(this.volume));
  }
}
