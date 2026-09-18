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
    // Échec de CRÉATION du module côté worklet ("ptr", voir
    // chiptune3.worklet.js — arrive si le buffer reçu n'est pas un fichier
    // .xm valide) : retenter avec une autre piste, mais jamais immédiatement
    // — sans le délai ci-dessous, un fichier qui échoue systématiquement à
    // se décoder (WASM en mauvais état, fichier corrompu...) déclenchait une
    // boucle fetch->échec->retry en rafale SANS AUCUNE pause, contrairement
    // au chemin réseau ("Load", géré séparément dans _loadCurrent avec
    // retries temporisés et plafonnés depuis le round précédent) — même
    // catégorie de bug que le 429 en rafale (voir plus bas), juste jamais
    // corrigée pour cette branche-ci jusqu'à présent.
    this.player.onError((e) => {
      console.warn("[music] onError", e); // voir le commentaire sur _loadCurrent — savoir quelle branche se déclenche plutôt que deviner
      if (e && e.type !== "Load") {
        this._loadRetries += 1;
        const delay = Math.min(10000, 2000 * this._loadRetries);
        setTimeout(() => this.playRandom(), delay);
      }
    });
    this.started = false;
    this.paused = false;
    this.muted = this._readBool(STORAGE_KEYS.muted, false);
    this.volume = this._readFloat(STORAGE_KEYS.volume, AUDIO.masterVolume);
    this.trackIndex = this._readInt(STORAGE_KEYS.track, 0);
    if (this.trackIndex < 0 || this.trackIndex >= AUDIO.tracks.length) this.trackIndex = 0;
    // Incrémenté à chaque _loadCurrent() : start() et playRandom() peuvent
    // partir un fetch() chacun sur le même clic (states/playing.js:startRun). Sans ce
    // jeton, la réponse arrivée en second gagnerait toujours, même périmée.
    this._loadToken = 0;
    // Compteur de tentatives ratées consécutives (voir _loadCurrent) —
    // remis à 0 dès qu'un chargement réussit.
    this._loadRetries = 0;
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
      .then((r) => {
        // fetch() ne rejette JAMAIS sur un statut d'erreur HTTP (404, 429...)
        // — seulement sur une vraie panne réseau. Sans ce contrôle explicite,
        // une réponse d'erreur (ex: 429 "trop de requêtes") était traitée
        // comme un fichier audio valide et passée telle quelle à
        // player.play(), qui plantait sur des données corrompues -> déclenchait
        // l'ancien retry immédiat -> qui se reprenait aussitôt un 429 -> boucle
        // de requêtes en rafale contre le serveur (vécu en prod, jamais reproduit
        // en local). D'où le throw ici, qui route proprement vers .catch().
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (token !== this._loadToken) return; // supplantée par une piste demandée depuis
        this._loadRetries = 0;
        this.player.play(buf);
        const target = this.muted ? 0 : this.volume;
        const t = this.player.context.currentTime;
        g.cancelScheduledValues(t);
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(target, t + 0.03);
      })
      .catch((err) => {
        if (token !== this._loadToken) return; // supplantée, la piste plus récente gère déjà le volume
        console.warn("[music] échec de chargement", track.file, err);
        // Le fondu de sortie a déjà coupé le son avant même de savoir si le
        // chargement allait réussir (voir plus haut) — sans ce filet, un
        // simple raté réseau laissait la musique silencieuse en permanence :
        // rien ne remontait jamais le volume tant qu'aucune piste suivante
        // ne chargeait derrière.
        const target = this.muted ? 0 : this.volume;
        const t = this.player.context.currentTime;
        g.cancelScheduledValues(t);
        g.linearRampToValueAtTime(target, t + 0.03);
        // Nouvelle tentative DIFFÉRÉE (2s, 4s, 6s, ... plafonné à 10s) —
        // jamais immédiate : un 429 veut dire "trop de requêtes", en relancer
        // une tout de suite ne fait qu'aggraver la situation (c'est exactement
        // ce que faisait l'ancien retry immédiat via onError, voir plus haut).
        // Pas de plafond sur le NOMBRE de tentatives (contrairement à avant,
        // 3 essais puis abandon définitif) : une panne un peu plus longue que
        // 12s (redéploiement du site, coupure réseau passagère) laissait la
        // musique silencieuse pour le reste de la partie, sans aucun moyen de
        // s'en remettre seule une fois la panne finie — le prochain
        // changement de piste automatique (onEnded) ne pouvait plus jamais se
        // déclencher puisque plus rien ne jouait. Coût négligeable à
        // continuer d'essayer (une requête toutes les 10s au pire).
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
    this._loadRetries = 0; // nouvelle demande explicite, pas une relance — voir _loadCurrent
    this._loadCurrent();
  }

  next() {
    this.trackIndex = (this.trackIndex + 1) % AUDIO.tracks.length;
    this._persist(STORAGE_KEYS.track, String(this.trackIndex));
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
    this._persist(STORAGE_KEYS.track, String(this.trackIndex));
    // Oubliée ici avant ce correctif (contrairement à start()/next()) : sans
    // ce reset, un simple accroc réseau isolé qui épuisait les 3 tentatives
    // UNE fois dans la session laissait ce compteur bloqué au-dessus de 3
    // pour le reste de la session — chaque partie suivante abandonnait alors
    // au moindre nouvel échec, même isolé, sans plus jamais réessayer.
    // Repéré comme la cause probable du bug de musique silencieuse encore
    // signalé après les 3 correctifs précédents (voir GAMEPLAY.md, Retour
    // d'expérience, 4e round).
    this._loadRetries = 0;
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
