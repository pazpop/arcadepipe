// Constantes globales — résolution interne, vitesses, difficulté, sons.
// Tout est regroupé ici pour éviter les valeurs magiques éparpillées dans
// les autres modules.

export const RES_W = 480;
export const RES_H = 270;

// Majeure figée à 2, sous-version = nombre de commits git (`git rev-list
// --count HEAD`) au moment du commit — jamais choisie à la main, donc
// toujours à jour sans y penser. Affichée au menu principal et aux crédits
// (voir hud.js). Mise à jour à chaque commit qui touche au jeu.
export const VERSION = "2.31";

export const PALETTE = {
  bgDeep: "#05060f",
  bgZones: ["#05060f", "#0a0614", "#060f0a", "#0f0605"],
  star: "#cfe8ff",
  player: "#4ee1ff",
  playerGlow: "#8ef4ff",
  bulletPlayer: "#ffe66d",
  bulletEnemy: "#ff5d9e",
  // Bleu-indigo (pas jaune-orangé, trop proche de bulletPlayer) : seule
  // teinte encore libre dans la palette du jeu.
  bulletEnemy2: "#5a7dff",
  // Rouge d'alerte générique (HUD : vies, bannières, avertissements) —
  // distinct de la couleur des ennemis "faciles" depuis que celle-ci est
  // passée au vert (code couleur par palier ci-dessous), les deux usages
  // n'ont plus de raison de partager la même valeur.
  danger: "#ff5d73",
  // Code couleur par palier de menace façon jeu de rôle (vert < jaune <
  // violet < or) — voir GAMEPLAY.md, section Charte graphique.
  enemyNormal: "#27be4d", // facile
  enemyGunner: "#beb227", // moyen (variante d'ennemi normal qui tire aussi, dès la vague 5)
  enemyElite: "#c86bff", // difficile
  boss: "#ffcc33", // or — 4e et dernier palier du code couleur ci-dessus
  bossWeakOn: "#fff44a", // jaune vif — doit trancher net avec la coque du boss
  bossWeakHit: "#ff9a3d", // encaissé un coup, pas encore critique
  bossWeakCritical: "#ff4d4d", // sur le point de céder
  bossWeakOff: "#4a1018",
  particle: "#ffb347",
  shield: "#5ec8ff",
  hud: "#cfe8ff",
  gold: "#ffd54a",
  silver: "#cfd8e3",
  bronze: "#c98a4b",
};

export const PLAYER = {
  // px/s — plafond du suivi progressif de la cible souris/tactile (player.js).
  // Très supérieur à la vitesse réelle de déplacement, pour un lissage
  // imperceptible qui absorbe quand même les sauts tactiles.
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
  bossWaveEvery: 5, // une vague sur N est une vague de boss — le "biodôme" (zonePalette) change au même rythme
  baseWaveKills: 10,
  waveKillsStep: 3,
  // Ennemis confinés au tiers droit (enemies.js) : le même rythme y paraît
  // plus dense, donc on démarre plus doucement (spawnIntervalStep inchangé).
  baseSpawnInterval: 0.9,
  spawnIntervalStep: 0.05,
  minSpawnInterval: 0.18,
  waveBreakDuration: 2.4, // saut spatial entre deux vagues
  // Plus long après un boss : le temps que le décor et les derniers ennemis
  // en fuite quittent l'écran.
  bossWaveBreakDuration: 3.6,
  // Tirs ennemis (élites + boss) accélèrent avec la vague, plafonnés pour
  // rester esquivables.
  bulletSpeedGrowthPerWave: 0.045,
  bulletSpeedCap: 1.7,
  noDamageWaveBonus: 500, // bonus de score si la vague se termine sans avoir perdu de vie (voir g.tookDamageThisWave dans game.js)
};

export function bulletSpeedFactor(wave) {
  return Math.min(DIFFICULTY.bulletSpeedCap, 1 + (wave - 1) * DIFFICULTY.bulletSpeedGrowthPerWave);
}

// Bonus temporaires lâchés par les ennemis détruits. "power" : dégâts
// renforcés, tir plus lent. "rapid" : tir très rapide, dégâts réduits.
// "nova" : instantané, détruit tous les ennemis à l'écran (pas le boss).
// "shield" : absorbe un nombre fixe de coups (shieldHits), pas temporisé.
export const POWERUP = {
  duration: 20, // secondes d'effet une fois ramassé (sans effet sur "nova"/"shield")
  shieldHits: 3, // nombre de coups absorbés avant que le bouclier se brise
  dropChanceNormal: 0.08,
  dropChanceElite: 0.25,
  fallSpeed: 26,
  radius: 5,
  lifetime: 9, // disparaît si non ramassé
  types: {
    power: { fireCooldownMul: 1.15, damage: 2, color: "#ff7043", label: "PUISSANCE", effect: "dégâts renforcés, tir plus lent" },
    rapid: { fireCooldownMul: 0.4, damage: 0.6, color: "#7dfcff", label: "RAFALE", effect: "tir très rapide, dégâts réduits" },
    // Cône de plombs à dégâts décroissants (voir firePlayerPellets et
    // PELLET_DAMAGE_DECAY dans projectiles.js) — `damage` ici est le dégât
    // initial par plomb, pas le total du tir. Cadence plus lente que
    // "power" : un tir plus engageant, pas un simple "tire plus fort partout".
    shotgun: { fireCooldownMul: 1.35, damage: 2, color: "#d4a24c", label: "CHEVROTINE", effect: "cône de plombs, dégâts décroissants avec la distance" },
    shield: { color: "#5ec8ff", label: "BOUCLIER", effect: "absorbe les prochains coups" },
    nova: { instant: true, color: "#ffffff", label: "NOVA", effect: "détruit tous les ennemis à l'écran" },
  },
  // Poids relatifs (pickPowerupType() dans game.js) — nova doit rester nettement plus rare.
  typeWeights: { power: 0.3, rapid: 0.3, shotgun: 0.16, shield: 0.16, nova: 0.08 },
};

export const BOSS = {
  weakPointsMin: 4,
  weakPointsMax: 6,
  weakPointHp: 3,
  phaseSpeedupFactor: 1.35, // patterns plus denses par point faible détruit
  bulletSpeed: 90,
  // 1er combat de boss (isFirstBoss() dans boss.js) volontairement plus
  // clément — le joueur n'a pas encore le rythme. Boss suivants non
  // concernés (multiplicateurs à 1).
  firstBossHpMul: 0.7,
  firstBossSpeedMul: 0.75,
  firstBossFireIntervalMul: 1.4,
  firstBossBulletCountMul: 0.7,
};

export const AUDIO = {
  masterVolume: 0.5,
  // Playlist de fichiers tracker .xm (voir Crédits), jamais resynthétisée.
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
  // Décalage horizontal (pas vertical) : le vaisseau "précède" le doigt, qui
  // ne masque plus la zone d'où viennent les tirs ennemis.
  touchXOffset: 28,
};
