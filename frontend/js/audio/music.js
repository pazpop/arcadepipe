// Musique : lecture d'une playlist de vrais fichiers tracker .xm via
// chiptune3.js (AudioWorklet, vrai module ES6 — voir lib/chiptune3.js). Le
// flux audio ne se recrée jamais en changeant d'écran (menu, jeu, game
// over, crédits...) — seul un changement de piste ou stop/play y touche.
import { AUDIO, STORAGE_KEYS } from "../config.js";
import { ChiptuneJsPlayer } from "../../lib/chiptune3.js";

export class MusicPlayer {
  // `audioContext` : partagé avec le moteur SFX (voir audio/sfx.js et
  // main.js) plutôt que d'en laisser chiptune3 créer un second — un contexte
  // qui n'est jamais explicitement repris dans le geste utilisateur reste
  // "verrouillé" côté iOS (la musique ne s'entendrait qu'avec le loquet
  // silencieux désactivé, contrairement aux bruitages sur le contexte
  // partagé, bien repris par audio.ensure()).
  constructor(audioContext) {
    // repeatCount 0 = chaque piste ne boucle plus sur elle-même ; on enchaîne
    // nous-mêmes sur la suivante via onEnded ci-dessous, pour que la
    // playlist tourne en continu plutôt que de rester bloquée sur un seul
    // morceau pendant toute une partie.
    this.player = new ChiptuneJsPlayer({
      repeatCount: 0,
      stereoSeparation: 100,
      interpolationFilter: 4,
      context: audioContext,
    });
    // Avec un contexte externe, chiptune3 ne connecte pas lui-même sa sortie
    // (voir chiptune3.js : `this.destination` reste `false` dans ce cas) —
    // sans cette ligne, la musique serait chargée et "jouée" en silence.
    this.player.gain.connect(audioContext.destination);
    this.player.onEnded(() => this.playRandom());
    this.started = false;
    this.paused = false;
    this.muted = this._readBool(STORAGE_KEYS.muted, false);
    this.volume = this._readFloat(STORAGE_KEYS.volume, AUDIO.masterVolume);
    this.trackIndex = this._readInt(STORAGE_KEYS.track, 0);
    if (this.trackIndex < 0 || this.trackIndex >= AUDIO.tracks.length) this.trackIndex = 0;
    // Incrémenté à chaque _loadCurrent() : le geste qui démarre l'audio
    // (start(), sur le premier clic) et celui qui lance la partie
    // (playRandom(), sur ce même clic — voir game.js:startRun) partent tous
    // les deux une requête fetch() en parallèle. Sans ce jeton, la réponse
    // arrivée en second gagne toujours, quelle que soit la piste réellement
    // voulue en dernier — d'où l'impression que la playlist aléatoire ne se
    // lance "parfois" pas : la piste par défaut gagnait la course.
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

  // Ne passe plus par player.load() (fetch + play immédiat) : on fait le
  // fetch nous-mêmes pour pouvoir (1) ignorer une réponse arrivée après
  // qu'une piste plus récente a été demandée entretemps (jeton _loadToken —
  // voir constructeur) et (2) couper le volume à zéro le temps de la
  // bascule, pour éviter le clic audible quand libopenmpt tranche net
  // l'ancien module au profit du nouveau, au beau milieu du signal.
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

  // Bascule stop/lecture — utilise la vraie pause du moteur (arrêt du
  // traitement audio), pas juste un volume à zéro. `togglePause()` est un
  // no-op silencieux côté worklet tant qu'aucune piste n'est chargée (voir
  // postMsg() dans chiptune3.js), donc pas besoin de vérifier ça nous-mêmes.
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
