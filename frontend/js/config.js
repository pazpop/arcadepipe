// Constantes globales — résolution interne, vitesses, difficulté, sons.
// Tout est regroupé ici pour éviter les valeurs magiques éparpillées dans
// les autres modules.

export const RES_W = 480;
export const RES_H = 270;

// Numéro de version affiché dans le panneau, aux crédits et sur la carte de
// partage. "dev" ici : la CI le remplace par 2.<nombre de commits git> en
// construisant l'image (voir frontend/Dockerfile).
export const VERSION = "dev";

export const PALETTE = {
  bgDeep: "#05060f",
  bgZones: ["#05060f", "#0a0614", "#060f0a", "#0f0605"],
  star: "#cfe8ff",
  player: "#4ee1ff",
  bulletPlayer: "#ffe66d",
  // Rose, partagé par tous les tirs d'ennemis normaux (élite + gunner) : même
  // tir visé, donc même façon de l'esquiver. Les tirs du boss ont leurs
  // propres couleurs (bulletBossDirect/bulletBossCircular ci-dessous).
  bulletEnemy: "#ff5d9e",
  // Tirs du boss : deux couleurs distinctes selon le style, pour que le
  // joueur sache quoi en faire d'un coup d'œil — direct = un vecteur à
  // esquiver sur le côté, circulaire = un mur à traverser par les trous.
  bulletBossDirect: "#5a7dff", // éventail visé (patternFan) — froid, tranche avec le rose des ennemis normaux
  bulletBossCircular: "#e8f4ff", // spirale/anneau (patternSpiralStep/patternRing) — blanc-glacé, contraste maximal pour les patterns les plus denses
  // Rouge d'alerte générique (HUD : vies, bannières, avertissements, kamikaze).
  danger: "#ff5d73",
  // Code couleur des ennemis façon jeu de rôle — voir GAMEPLAY.md, « Partis pris
  // visuels et sonores ». Le jaune/or reste exclusif au boss (aucun autre
  // ennemi ne s'en approche), pour ne jamais laisser croire qu'un ennemi
  // normal "vaut" le boss.
  enemyNormal: "#27be4d", // facile (petit vaisseau)
  enemyGunner: "#2748be", // moyen (variante d'ennemi normal qui tire aussi, dès la vague 5) — bleu, pour ne pas empiéter sur le jaune/or réservé au boss
  enemyElite: "#c86bff", // difficile (violet)
  boss: "#ffcc33", // or — jamais réutilisé ailleurs
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
  restX: RES_W * 0.18, // position de repos, en début de partie et dans le niveau bonus
  entryX: -20, // hors écran à gauche : départ des glissées d'entrée
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
  // Les ennemis apparaissent dans le tiers droit (enemies.js), où le même
  // rythme paraît plus dense : on démarre doucement.
  baseSpawnInterval: 0.9,
  spawnIntervalStep: 0.05,
  minSpawnInterval: 0.18,
  waveBreakDuration: 2.4, // saut spatial entre deux vagues
  // Plus long après un boss : le temps que le décor et les derniers ennemis
  // en fuite quittent l'écran.
  bossWaveBreakDuration: 3.6,
  // Tirs ennemis (gunners, élites, boss) accélèrent avec la vague, plafonnés pour
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
// "shield" : absorbe un nombre fixe de coups (shieldHits), pas temporisé.
// NOVA n'est pas un bonus : ressource rechargée par le graze (voir NOVA plus bas).
export const POWERUP = {
  duration: 20, // secondes d'effet une fois ramassé (sans effet sur "shield")
  shieldHits: 3, // nombre de coups absorbés avant que le bouclier se brise
  dropChanceNormal: 0.08,
  dropChanceElite: 0.25,
  fallSpeed: 26,
  radius: 5,
  lifetime: 9, // disparaît si non ramassé
  // Noms et effets affichés : clés "powerup.<type>" des fichiers de langue (i18n/).
  types: {
    power: { fireCooldownMul: 1.15, damage: 2, color: "#ff7043" },
    rapid: { fireCooldownMul: 0.4, damage: 0.6, color: "#7dfcff" },
    // Cône de plombs à dégâts décroissants (voir firePlayerPellets et
    // PELLET_DAMAGE_DECAY dans projectiles.js) — `damage` ici est le dégât
    // initial par plomb, pas le total du tir. Cadence plus lente que
    // "power" : un tir plus engageant, pas un simple "tire plus fort partout".
    shotgun: { fireCooldownMul: 1.35, damage: 2, color: "#d4a24c" },
    shield: { color: "#5ec8ff" },
  },
  // Poids relatifs (pickPowerupType() dans states/playing.js).
  typeWeights: { power: 0.3, rapid: 0.3, shotgun: 0.2, shield: 0.2 },
};

export const BOSS = {
  weakPointsMin: 4,
  weakPointsMax: 6,
  weakPointHp: 5,
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
  // Playlist : morceaux de mall-e (voir Crédits).
  tracks: ["music/first.mp3", "music/second.mp3", "music/third.mp3", "music/fourth.mp3"],
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
  gameSpeed: "arcadepipe_game_speed",
  analyticsConsent: "arcadepipe_analytics_consent",
  lang: "arcadepipe_lang",
};

// Multiplicateurs de vitesse de jeu proposés par le bouton "VITESSE DU JEU" (panneau
// bas gauche) — voir main.js. N'affecte que le rythme du jeu (dt), jamais
// l'audio (musique/bruitages tournent sur leur propre horloge réelle).
export const GAME_SPEEDS = [1, 1.5, 2];

export const INPUT = {
  // Décalage horizontal (pas vertical) : le vaisseau "précède" le doigt, qui
  // ne masque pas la zone d'où viennent les tirs ennemis.
  touchXOffset: 45,
};

// Micro-gel à l'impact (triggerHitStop, states/playing.js), en secondes.
// Réservé aux événements rares : rien sur un kill normal, sinon l'effet se
// banalise. Valeurs à ajuster au ressenti.
export const HIT_STOP = {
  elite: 0.08,
  weakPoint: 0.13,
  bossVictory: 0.14,
};

// Frôlement des tirs ennemis (graze.js) : récompense l'esquive serrée plutôt
// que large, alimente la jauge NOVA (voir NOVA ci-dessous).
export const GRAZE = {
  // Tailles de chaîne saluées par un son à part (playGrazeMilestone) — à ajuster au ressenti.
  milestones: [5, 10, 15],
  // Rayon depuis le centre du vaisseau : bien plus grand que
  // PLAYER.hitboxRadius, proche de la moitié de la largeur du sprite, pour que
  // le frôlement se déclenche au ras de la silhouette visible.
  radius: 7,
  // Le corps d'un ennemi (tous types, voir updateGraze dans graze.js — le
  // boss fait exception, seuls ses tirs comptent) peut regrazer après ce
  // délai tant qu'il reste à proximité, contrairement à un tir qui ne graze
  // qu'une fois pendant toute sa vie (voir `grazed` sur les projectiles dans
  // projectiles.js).
  bodyCooldown: 1.5,
  baseScore: 15, // multiplié par la taille de la chaîne courante (voir graze.js)
  grazePerCharge: 12, // nombre de grazes pour remplir une charge NOVA
};

// Distance parcourue, affichée en fin de partie et sur la carte de partage :
// purement cosmétique, multipliée par le warp (states/playing.js).
export const DISTANCE = {
  lightYearsPerSecond: 1,
};

// NOVA : charge stockable gagnée par le graze, dépensée par useNova (states/playing.js).
export const NOVA = {
  color: PALETTE.gold,
  baseMaxStock: 1,
  // 2e charge disponible dès la vague du 2e combat de boss — dérivé de
  // DIFFICULTY.bossWaveEvery (comme isFirstBoss dans boss.js) plutôt qu'un
  // numéro de vague en dur.
  extraStockFromBossCount: 2,
};

// Niveau bonus (bonusLevel.js) : traverser des anneaux au lieu de combattre.
// Offert avant les vagues 10, 20, 30... si le score atteint le seuil du cycle,
// qui grimpe à chaque fois (scoreThreshold * numéro du cycle, sauf le premier).
// Récompense : jauge NOVA, en proportion des anneaux réussis.
export const BONUS_LEVEL = {
  everyNWaves: 10,
  // Seuil du tout premier niveau bonus (vague 10), volontairement bas et
  // indépendant de la formule des cycles suivants — sert de "vitrine" que la
  // plupart des joueurs peuvent atteindre, pas juste les runs déjà excellentes.
  firstScoreThreshold: 1500,
  scoreThreshold: 4000,
  ringCount: 10,
  ringSpeed: 110,
  ringSpawnInterval: 1.3,
  ringOuterRadius: 22,
  ringInnerRadius: 13,
  ringInnerRadiusMin: 7,
  // Rétrécit légèrement à chaque anneau (jusqu'au plancher ci-dessus) — une
  // petite montée en difficulté dans le niveau bonus lui-même, pas juste une
  // suite de portes identiques.
  ringTighten: 0.6,
  // Entrée en douceur du vaisseau (glissée depuis la gauche, comme au tout
  // début d'une partie) + message explicatif — aucun anneau ne spawn avant
  // la fin de cette phase (voir spawnTimer initial dans createBonusLevel).
  introDuration: 3,
  warp: 3, // vitesse du défilement de fond pendant le niveau (effet "tunnel"), modeste comparé au x10 du saut spatial entre vagues
};
