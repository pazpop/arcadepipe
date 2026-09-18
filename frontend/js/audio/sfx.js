// Synthèse audio 100% Web Audio API — aucun fichier son. Chaque effet crée
// ses propres oscillateurs/noeuds à la volée puis les jette. Rampes de gain
// de 5-10ms pour éviter tout clic au démarrage/arrêt.
import { STORAGE_KEYS } from "../config.js";
import { loadUnitFloat, saveItem } from "../storage.js";

export class AudioEngine {
  // Contexte créé tout de suite (geste utilisateur requis seulement pour le
  // RESUME, voir ensure()) — partagé avec le lecteur de musique (music.js)
  // plutôt qu'un second contexte.
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.muted = false;
    this.masterVolume = loadUnitFloat(STORAGE_KEYS.sfxVolume, 0.5);
    this.master.gain.value = this.masterVolume;
    this.master.connect(this.ctx.destination);
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
    saveItem(STORAGE_KEYS.sfxVolume, this.masterVolume);
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

  // Bruit blanc filtré passe-bas avec balayage de la fréquence de coupure —
  // le "corps" commun à explosion/NOVA/fusil à pompe ci-dessous ; chacune
  // garde sa propre enveloppe de volume (c'est elle qui les distingue au son),
  // appliquée par l'appelant sur le filtre renvoyé ici (pas encore connecté
  // à une sortie).
  _noiseBurst(duration, cutoffStart, cutoffEnd) {
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoffStart, now);
    filter.frequency.exponentialRampToValueAtTime(cutoffEnd, now + duration);
    noise.connect(filter);
    noise.start(now);
    noise.stop(now + duration);
    return filter;
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

  // Tir joueur : "pew" glissé vers le grave. À cette cadence (plusieurs
  // tirs/s), on varie aussi le timbre et l'amplitude du glissando — la
  // hauteur seule restait trop répétitive.
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

  // Explosion : bruit blanc filtré passe-bas + glissement de fréquence de
  // coupure, enveloppe courte (Attack 0, Decay ~150ms, pas de Sustain).
  playExplosion() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 0.3;
    const filter = this._noiseBurst(duration, 200, 20);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.005); // Attack ~0ms
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.005 + 0.15); // Decay 150ms vers ~0
    g.gain.linearRampToValueAtTime(0, now + duration);

    filter.connect(g);
    g.connect(this.master);
  }

  // Transition "saut spatial" : glissement montant sur 2s avec légère
  // distorsion, synchronisé avec l'accélération visuelle (states/playing.js).
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

  // NOVA : explosion nettement plus "large" qu'un impact normal
  // (playExplosion) — bruit filtré plus long + un sub grave en dessous pour
  // le poids. L'écran tremble déjà fort (triggerShake dans states/playing.js), le son
  // doit suivre sinon l'effet paraît muet malgré l'écran qui vibre.
  playNovaBlast() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 0.6;
    const filter = this._noiseBurst(duration, 500, 20);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.32, now + 0.008);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    filter.connect(noiseGain);
    noiseGain.connect(this.master);

    // Sub grave : c'est lui qui donne le "poids" qu'un simple bruit filtré n'a pas.
    const sub = this.ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(90, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + duration * 0.8);
    const subGain = this._envGain(duration * 0.85, 0.3, 0.005, duration * 0.5);
    sub.connect(subGain);
    subGain.connect(this.master);
    sub.start(now);
    sub.stop(now + duration);
  }

  playBossHit() {
    this._tone({ type: "sawtooth", startFreq: 300, endFreq: 60, duration: 0.2, gain: 0.15 });
  }

  // Fusil à pompe (bonus CHEVROTINE) : superpose un transitoire (bruit
  // filtré, même technique que playExplosion mais plus grave dès le départ)
  // et un corps grave (onde descendante courte, comme playBossHit mais plus
  // bas) — le mélange donne un "poids" que ni l'un ni l'autre seul ne
  // rendrait, pour bien se distinguer du "pew" aigu du tir normal.
  playShotgunBlast() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const duration = 0.15;
    const filter = this._noiseBurst(duration, 700, 80);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    filter.connect(noiseGain);
    noiseGain.connect(this.master);

    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
    const oscGain = this._envGain(0.14, 0.2, 0.002, 0.1);
    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Survol menu : "tic" bref et discret, retour sonore léger — déclenché à
  // chaque CHANGEMENT d'item, pas en continu.
  playMenuHover() {
    this._tone({ type: "sine", startFreq: 900, endFreq: 1100, duration: 0.035, gain: 0.05 });
  }

  // Frôlement (graze.js) : "tic" aigu et très bref, la hauteur monte avec le
  // palier de chaîne (plafonné côté appelant) — une chaîne qui s'enchaîne se
  // ressent au son, pas juste au score qui défile.
  playGraze(tier = 1) {
    const freq = 900 + Math.min(tier, 8) * 90;
    this._tone({ type: "sine", startFreq: freq, endFreq: freq * 1.15, duration: 0.045, gain: 0.05 });
  }

  // Anneau du niveau bonus (bonusLevel.js) réussi : note franche, un peu plus
  // riche que le "tic" du graze — un vrai petit succès à chaque passage.
  playRingPass(tier = 1) {
    const freq = 700 + Math.min(tier, 10) * 40;
    this._tone({ type: "triangle", startFreq: freq, endFreq: freq * 1.3, duration: 0.09, gain: 0.09 });
  }

  // Anneau raté : sourd et bref, jamais punitif (aucune vie ne peut être
  // perdue dans le niveau bonus) — juste un accusé de réception discret.
  playRingMiss() {
    this._tone({ type: "sine", startFreq: 220, endFreq: 140, duration: 0.08, gain: 0.05 });
  }

  // Konami code (voir main.js) : jingle court-court-court-long, mélodie originale.
  // Chaque note a sa propre enveloppe de volume : _envGain programme ses rampes
  // à partir de `ctx.currentTime` au moment de l'appel, ce qui les ferait
  // toutes finir avant que les oscillateurs, eux décalés dans le temps, ne sonnent.
  playKonami() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // start/duration en secondes depuis "now".
    const notes = [
      { freq: 392, start: 0, duration: 0.1 }, // sol
      { freq: 523, start: 0.1, duration: 0.1 }, // do
      { freq: 659, start: 0.2, duration: 0.12 }, // mi
      { freq: 784, start: 0.32, duration: 0.3 }, // sol aigu, tenue — le "ta-daa" final
      { freq: 1175, start: 0.38, duration: 0.15 }, // ré très aigu, éclat par-dessus la tenue
    ];
    for (const { freq, start, duration } of notes) {
      const t = now + start;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const attack = 0.008;
      const release = duration * 0.4;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.15, t + attack);
      g.gain.setValueAtTime(0.15, t + Math.max(attack, duration - release));
      g.gain.linearRampToValueAtTime(0, t + duration);
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    }
  }

  // Ramassage de bonus : deux notes montantes, timbre franc et positif, distinct des tirs/impacts.
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
