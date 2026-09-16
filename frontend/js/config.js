// Constantes globales — résolution interne, vitesses, difficulté, sons.
// Tout est regroupé ici pour éviter les valeurs magiques éparpillées dans
// les autres modules.

export const RES_W = 480;
export const RES_H = 270;

export const PALETTE = {
  bgDeep: "#05060f",
  bgZones: ["#05060f", "#0a0614", "#060f0a", "#0f0605"],
  star: "#cfe8ff",
  player: "#4ee1ff",
  playerGlow: "#8ef4ff",
  bulletPlayer: "#ffe66d",
  bulletEnemy: "#ff5d9e",
  // Bleu-indigo plutôt que jaune-orangé (#ffcc33, trop proche de bulletPlayer
  // #ffe66d — signalé peu lisible en jeu) : seule teinte encore libre qui ne
  // chevauche aucune autre couleur du jeu (jaune joueur, rose bulletEnemy,
  // violet enemyElite, cyan vaisseau/bouclier, orange des bonus).
  bulletEnemy2: "#5a7dff",
  enemyNormal: "#ff5d73",
  enemyElite: "#c86bff",
  boss: "#ffcc33",
  bossWeakOn: "#fff44a", // jaune vif — doit trancher net avec la coque du boss
  bossWeakOff: "#4a1018",
  particle: "#ffb347",
  shield: "#5ec8ff",
  hud: "#cfe8ff",
  gold: "#ffd54a",
  silver: "#cfd8e3",
  bronze: "#c98a4b",
};

export const PLAYER = {
  // px/s (résolution interne 480x270) — plafond du suivi progressif de la
  // cible souris/tactile (voir player.js). Volontairement très supérieur à
  // la vitesse de déplacement réelle d'une souris/d'un doigt sur ce canvas,
  // pour que le lissage reste quasi imperceptible en jeu normal tout en
  // absorbant les sauts d'un seul événement tactile (pas de snap brutal).
  speed: 2000,
  w: 14,
  h: 9,
  hitboxRadius: 2.2, // cockpit uniquement, style danmaku
  fireCooldown: 0.11,
  bulletSpeed: 260,
  invulnDuration: 1.4,
  shieldHitInvuln: 0.35, // invulnérabilité brève après un coup absorbé par le bouclier (évite de le vider en une frame)
  startingLives: 3,
  maxLives: 5, // plafond de la vie gagnée à chaque victoire de boss
};

export const DIFFICULTY = {
  bossWaveEvery: 5, // une vague sur N est une vague de boss — le changement de "biodôme" (zonePalette dans game.js) suit ce même rythme, un nouveau après chaque boss
  baseWaveKills: 10,
  waveKillsStep: 3,
  // Les ennemis sont désormais confinés au tiers droit de l'écran (voir
  // enemies.js) : le même rythme de spawn qu'avant y paraît plus dense
  // puisqu'ils se concentrent sur un tiers de la largeur au lieu de toute
  // l'écran — on démarre donc plus doucement, la montée en cadence
  // (spawnIntervalStep) reste inchangée d'une vague à l'autre.
  baseSpawnInterval: 0.9,
  spawnIntervalStep: 0.05,
  minSpawnInterval: 0.18,
  waveBreakDuration: 2.4, // saut spatial entre deux vagues
  // Un peu plus long après un boss : le temps que le décor "Étoile Noire"
  // (voir triggerDeathStarLeave dans stars.js) et les derniers vaisseaux
  // ennemis en fuite (voir enemyLeaveSpeed dans enemies.js) aient
  // complètement quitté l'écran avant l'arrivée des ennemis normaux.
  bossWaveBreakDuration: 3.6,
  // Les tirs ennemis (élites + boss) accélèrent progressivement avec la
  // vague, plafonnés pour rester esquivables même en fin de partie.
  bulletSpeedGrowthPerWave: 0.045,
  bulletSpeedCap: 1.7,
};

export function bulletSpeedFactor(wave) {
  return Math.min(DIFFICULTY.bulletSpeedCap, 1 + (wave - 1) * DIFFICULTY.bulletSpeedGrowthPerWave);
}

// Bonus temporaires laissés occasionnellement par les ennemis détruits.
// "power" frappe plus fort mais cadence réduite ; "rapid" tire beaucoup plus
// vite mais un peu plus faible (dégâts fractionnaires : un ennemi normal
// encaisse 2 tirs au lieu d'1, malgré la cadence ~2.5x plus élevée). "nova"
// est un effet instantané (pas un buff temporisé comme les deux autres) :
// détruit tous les ennemis normaux/élites visibles à l'écran, pas le boss.
// "shield" n'est pas non plus temporisé : il encaisse un nombre fixe de
// coups (voir shieldHits) avant de se briser, quelle que soit la durée.
export const POWERUP = {
  duration: 20, // secondes d'effet une fois ramassé (sans effet sur "nova"/"shield")
  shieldHits: 3, // nombre de coups absorbés avant que le bouclier se brise
  dropChanceNormal: 0.05,
  dropChanceElite: 0.18,
  fallSpeed: 26,
  radius: 5,
  lifetime: 9, // disparaît si non ramassé
  types: {
    power: { fireCooldownMul: 1.15, damage: 2, color: "#ff7043", label: "PUISSANCE", effect: "dégâts renforcés, tir plus lent" },
    rapid: { fireCooldownMul: 0.4, damage: 0.6, color: "#7dfcff", label: "RAFALE", effect: "tir très rapide, dégâts réduits" },
    shield: { color: "#5ec8ff", label: "BOUCLIER", effect: "absorbe les prochains coups" },
    nova: { instant: true, color: "#ffffff", label: "NOVA", effect: "détruit tous les ennemis à l'écran" },
  },
  // Poids relatifs quand un bonus est tiré (voir pickPowerupType() dans
  // game.js) — nova doit rester nettement plus rare que les autres.
  typeWeights: { power: 0.36, rapid: 0.36, shield: 0.2, nova: 0.08 },
};

export const BOSS = {
  weakPointsMin: 4,
  weakPointsMax: 6,
  weakPointHp: 3,
  phaseSpeedupFactor: 1.35, // patterns plus denses par point faible détruit
  bulletSpeed: 90,
  // Le tout premier combat de boss (vague DIFFICULTY.bossWaveEvery — voir
  // isFirstBoss() dans boss.js) est volontairement plus clément : un joueur
  // qui voit un boss pour la première fois n'a pas encore le rythme. Les
  // vagues de boss suivantes ne sont pas concernées (multiplicateurs à 1).
  firstBossHpMul: 0.7,
  firstBossSpeedMul: 0.75,
  firstBossFireIntervalMul: 1.4,
  firstBossBulletCountMul: 0.7,
};

export const AUDIO = {
  masterVolume: 0.5,
  // Playlist de vrais fichiers tracker .xm (voir Crédits) — la musique n'est
  // jamais resynthétisée à la main, seulement rejouée telle quelle.
  tracks: [
    { file: "music/age-of-empires-3.xm", title: "Age of Empires III", artist: "DEViANCE" },
    { file: "music/battle-for-middle-earth.xm", title: "Battle for Middle-Earth", artist: "DEViANCE" },
    { file: "music/mercedes-benz-world-racing.xm", title: "Mercedes-Benz World Racing", artist: "DEViANCE" },
    { file: "music/neverwinter-nights.xm", title: "Neverwinter Nights", artist: "DEViANCE" },
    { file: "music/prototype.xm", title: "Prototype", artist: "h4x0r" },
  ],
};

export const STORAGE_KEYS = {
  muted: "arcadepipe_muted",
  volume: "arcadepipe_volume",
  sfxVolume: "arcadepipe_sfx_volume",
  track: "arcadepipe_track",
  crt: "arcadepipe_crt",
  autoFire: "arcadepipe_autofire",
  panelCollapsed: "arcadepipe_panel_collapsed",
  seenIntro: "arcadepipe_seen_intro",
  lastPlayerName: "arcadepipe_last_player_name",
};

export const INPUT = {
  // Décalage HORIZONTAL (vers la droite, sens du tir/des ennemis) plutôt
  // que vertical : le vaisseau "précède" le doigt au lieu de flotter
  // au-dessus — le doigt ne masque plus la zone d'où viennent les tirs
  // ennemis, plus facile à esquiver.
  touchXOffset: 28,
};
