// Synthèse audio 100% Web Audio API — aucun fichier son. Chaque effet crée
// ses propres oscillateurs/noeuds à la volée puis les jette (pas de buffers
// préchargés, pas de mémoire audio retenue) ; des rampes de gain de 5-10ms
// évitent tout clic/pop au démarrage et à l'arrêt. Le contexte audio gère
// nativement une bonne douzaine de voix simultanées sans latence perceptible,
// largement au-dessus des 8 voix demandées.
import { STORAGE_KEYS } from "../config.js";

export class AudioEngine {
  // Le contexte est créé tout de suite (pas besoin d'un geste utilisateur
  // pour le CRÉER, seulement pour le RESUME — voir ensure()) : le lecteur de
  // musique (audio/music.js) partage ce même contexte plutôt que d'en créer
  // un second, ce qui évitait auparavant à celui-ci d'être débloqué côté iOS.
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.muted = false;
    this.masterVolume = this._readFloat(STORAGE_KEYS.sfxVolume, 0.5);
    this.master.gain.value = this.masterVolume;
    this.master.connect(this.ctx.destination);
  }

  _readFloat(key, fallback) {
    try {
      const v = parseFloat(localStorage.getItem(key));
      return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
    } catch {
      return fallback;
    }
  }

  _persist(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* stockage indisponible — pas bloquant */
    }
  }

  // Le contexte doit être repris après un geste utilisateur (règle des
  // navigateurs) — appeler ensure() au premier clic/touch/keydown.
  ensure() {
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime, 0.01);
  }

  setMasterVolume(v) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.01);
    this._persist(STORAGE_KEYS.sfxVolume, String(this.masterVolume));
  }

  _envGain(duration, peak = 1, attack = 0.005, release = 0.01) {
    const g = this.ctx.createGain();
    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + attack);
    g.gain.setValueAtTime(peak, now + Math.max(attack, duration - release));
    g.gain.linearRampToValueAtTime(0, now + duration);
    return g;
  }

  _tone({ type = "square", startFreq, endFreq, duration = 0.1, gain = 0.15 }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this._envGain(duration, gain);
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // Tir joueur : "pew" glissé vers le grave. Tir manuel tenu = plusieurs
  // tirs/seconde, donc au-delà de la simple hauteur on fait aussi varier le
  // timbre (forme d'onde) et l'amplitude du glissando — une variance de
  // hauteur seule restait trop reconnaissable/répétitive à cette cadence.
  playPlayerShot(colorKey = "normal") {
    const waveforms = ["square", "triangle", "sawtooth"];
    const type = waveforms[Math.floor(Math.random() * waveforms.length)];
    const baseStart = { normal: 800, power: 620, rapid: 980 }[colorKey] ?? 800;
    const baseEnd = { normal: 400, power: 260, rapid: 560 }[colorKey] ?? 400;
    const pitchVariance = 0.8 + Math.random() * 0.4; // ±20%
    const sweepVariance = 0.7 + Math.random() * 0.5; // amplitude du glissando, ±30%
    this._tone({
      type,
      startFreq: baseStart * pitchVariance,
      endFreq: baseStart * pitchVariance - (baseStart - baseEnd) * sweepVariance,
      duration: 0.07 + Math.random() * 0.05,
      gain: 0.075 + Math.random() * 0.03,
    });
  }

  // Tir ennemi : timbre différent (triangle, fréquence plus basse) pour
  // qu'on distingue au son qui vient de tirer sans regarder l'écran.
  playEnemyShot() {
    this._tone({ type: "triangle", startFreq: 600, endFreq: 350, duration: 0.09, gain: 0.08 });
  }

  // Explosion : bruit blanc filtré passe-bas + glissement de fréquence de
  // coupure, enveloppe courte (Attack 0, Decay ~150ms, pas de Sustain).
  playExplosion() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 0.3;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(20, now + duration);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.005); // Attack ~0ms
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.005 + 0.15); // Decay 150ms vers ~0
    g.gain.linearRampToValueAtTime(0, now + duration);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    noise.start(now);
    noise.stop(now + duration);
  }

  // Transition "saut spatial" entre deux vagues : glissement montant sur 2s
  // avec une légère distorsion (waveshaper), synchronisé avec l'accélération
  // visuelle du fond dans game.js.
  playWarpTransition() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 2;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + duration);

    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.5); // légère distorsion douce
    }
    shaper.curve = curve;

    const g = this._envGain(duration, 0.1, 0.02, 0.3);
    osc.connect(shaper);
    shaper.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playBossHit() {
    this._tone({ type: "sawtooth", startFreq: 300, endFreq: 60, duration: 0.2, gain: 0.15 });
  }

  // Survol d'un item de menu (souris) : un simple "tic" bref et discret,
  // pas un vrai son de tir/impact — sert juste de retour sonore léger,
  // volontairement très peu présent pour ne pas fatiguer en cas de survols
  // rapides répétés (déclenché à chaque CHANGEMENT d'item, pas en continu).
  playMenuHover() {
    this._tone({ type: "sine", startFreq: 900, endFreq: 1100, duration: 0.035, gain: 0.05 });
  }

  // Ramassage de bonus : deux notes montantes, timbre franc et positif —
  // distinct des sons de tir/impact pour se reconnaître sans y penser.
  playPowerup() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [520, 780].forEach((freq, i) => {
      const start = now + i * 0.06;
      const osc = this.ctx.createOscillator();
      const g = this._envGain(0.12, 0.12, 0.005, 0.08);
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, start);
      osc.connect(g);
      g.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.14);
    });
  }
}
