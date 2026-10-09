// Français — langue de référence : toute clé ajoutée ici doit l'être dans
// les autres fichiers de ce dossier (vérifié par i18n.test.js).
// {nom} est remplacé par une valeur au moment de l'affichage : à garder tel quel.
export default {
  // Drapeaux du bouton qui propose de passer à cette langue : un nom par
  // drapeau, dessiné par la classe .flag-<nom> de css/style.css.
  "lang.flags": "fr qc",

  // --- Panneau de réglages (HTML, bas à gauche) ---
  "panel.pause.title": "Pause",
  "panel.music": "MUSIQUE (by Mall-E)",
  "panel.music.stop": "Stop / lecture",
  "panel.music.next": "Piste suivante",
  "panel.music.volume": "Volume musique",
  "panel.sfx": "BRUITAGES",
  "panel.sfx.volume": "Volume bruitages",
  "panel.speed": "VITESSE DU JEU",
  "panel.speed.title": "Vitesse du jeu (n'affecte pas la musique/les bruitages)",
  "panel.autofire": "Tir automatique",
  "panel.crt": "Filtre rétro",
  "panel.help": "Aide",
  "panel.fullscreen": "Plein écran",
  "panel.fullscreen.exit": "Quitter le plein écran",
  "panel.cookies": "Cookies",
  "panel.cookies.title": "Changer mon choix de cookies",
  "panel.lang.title": "Changer de langue",
  "panel.privacy": "Confidentialité",
  "panel.toggle.title": "Réglages",
  "nova.title": "Déclencher NOVA (Espace)",
  "share.button": "📤 Partager",
  "share.title": "Générer une image à partager",
  "share.done": "✅ Image téléchargée",

  // --- Bandeau de consentement ---
  "cookie.aria": "Consentement aux cookies",
  "cookie.text": "Acceptes-tu Google Analytics (cookies de mesure d'audience) ? Il sert à compter les visites.",
  "cookie.more": "En savoir plus",
  "cookie.accept": "Accepter",
  "cookie.decline": "Refuser",

  // --- Menu principal ---
  "menu.lore": "La galaxie agonise sous les flottes ennemies —\nseul aux commandes du dernier chasseur libre,\ntu es son unique espoir de survie.",
  "menu.play": "JOUER",
  "menu.leaderboard": "CLASSEMENT",
  "menu.help": "AIDE",
  "menu.credits": "CRÉDITS",

  // --- HUD en partie ---
  "hud.score": "SCORE {score}",
  "hud.wave": "VAGUE {wave}",
  "hud.bonusLevel": "NIVEAU BONUS — ANNEAUX {passed}/{total}",
  "hud.intact": "INTACT +{bonus}",
  "hud.controlHint": "MAINTIENS CLIC / DOIGT POUR TIRER",
  "bonus.intro.title": "NIVEAU BONUS DÉBLOQUÉ !",
  "bonus.intro.line1": "Ton score l'a débloqué",
  "bonus.intro.line2": "Traverse les anneaux pour charger ta jauge NOVA !",

  // --- Bannières ---
  "banner.bossWave": "VAGUE {wave} — ARME MASSIVE EN APPROCHE",
  "banner.waveDone": "VAGUE {wave} TERMINÉE",
  "banner.waveDoneIntact": "VAGUE {wave} TERMINÉE — SANS DÉGÂTS ! +{bonus}",
  "banner.bonusDone": "NIVEAU BONUS TERMINÉ : {passed}/{total} ANNEAUX — NOVA +{percent}%",
  "banner.nova": "NOVA !",

  // --- Bonus ---
  "powerup.power": "PUISSANCE",
  "powerup.power.effect": "dégâts renforcés, tir plus lent",
  "powerup.rapid": "RAFALE",
  "powerup.rapid.effect": "tir très rapide, dégâts réduits",
  "powerup.shotgun": "CHEVROTINE",
  "powerup.shotgun.effect": "cône de plombs, dégâts décroissants avec la distance",
  "powerup.shield": "BOUCLIER",
  "powerup.shield.effect": "absorbe les prochains coups",

  // --- Pause ---
  "pause.title": "PAUSE",
  "pause.resume": "REPRENDRE",
  "pause.menu": "MENU PRINCIPAL",
  "quit.title": "QUITTER LA PARTIE ?",
  "quit.warning": "TA PROGRESSION ACTUELLE SERA PERDUE.",
  "quit.yes": "OUI, QUITTER",
  "quit.no": "NON, CONTINUER",

  // --- Aide ---
  "help.title": "AIDE",
  "help.title.bonus": "AIDE — BONUS",
  "help.title.enemies": "AIDE — ENNEMIS",
  "help.move": "DÉPLACEMENT",
  "help.move.detail": "Souris ou doigt : dirige le vaisseau",
  "help.fire": "TIR",
  "help.fire.detail": 'Automatique. Décoche "Tir automatique" (bas à gauche) pour tirer en maintenant le clic ou le doigt',
  "help.nova": "NOVA",
  "help.nova.detail":
    "Frôle (sans le toucher) un tir ennemi ou un vaisseau ennemi — pas le boss — pour charger la jauge NOVA en haut à gauche : prends des risques ! Une fois pleine, ESPACE (ou le bouton tactile en bas à droite) détruit tous les ennemis à l'écran et leurs tirs, jamais le boss. Jusqu'à 2 charges en réserve dès le 2e combat de boss (1 seule avant), à déclencher quand tu veux.",
  "help.boss": "BOSS",
  "help.boss.detail": "Vise les points faibles JAUNES, évite sa coque — le vaincre donne +1 vie",
  "help.music": "MUSIQUE",
  "help.music.detail": "Playlist aléatoire, réglable en bas à gauche",
  "help.keys": "RACCOURCIS CLAVIER",
  "help.keys.detail": "Échap/P : pause · Espace : NOVA · M : son",
  "help.prev": "◀ PRÉC.",
  "help.next": "SUIV. ▶",
  "help.continue": "▶ CONTINUER",
  "enemy.normal": "FACILE — 1 PV, pas de tir, ligne droite",
  "enemy.gunner": "MOYEN — 2 PV, tir visé (vague 6+)",
  "enemy.elite": "ÉLITE — 3 PV, tir visé, ondule (vague 3+)",
  "enemy.kamikaze": "KAMIKAZE — 1 PV, fonce sur toi (vague 4+)",

  // --- Fin de partie ---
  "gameover.title": "GAME OVER",
  "gameover.stats": "SCORE {score}  ·  VAGUE {wave}  ·  {kills} ENNEMIS",
  "gameover.distance": "{distance} ANNÉES-LUMIÈRE PARCOURUES",
  "gameover.replay": "REJOUER",
  "gameover.enterName": "ENTRER MON PSEUDO",
  "gameover.top": "TU ENTRES DANS LE TOP {size} !",
  "name.title": "TU ENTRES DANS LE CLASSEMENT !",
  "name.prompt": "ENTRE TON PSEUDO (8 CAR. MAX)",
  "name.validate": "▶ VALIDER",

  // --- Classement ---
  "board.games": "PARTIES JOUÉES : {count}",
  "board.rank": "RANG",
  "board.name": "PSEUDO",
  "board.score": "SCORE",
  "board.wave": "VAGUE",
  "board.kills": "TUÉS",
  "board.empty": "Aucun score pour l'instant.",
  "board.error": "Classement indisponible pour le moment.",
  "board.back": "ÉCHAP / TAP — RETOUR",

  // --- Crédits ---
  "credits.by": "UN JEU DÉVELOPPÉ PAR PAZPOP",
  "credits.source": "CODE SOURCE",
  "credits.music": "MUSIQUE",
  "credits.thanks": "REMERCIEMENTS",
  "credits.thanks.music": "MALL-E, POUR SA MUSIQUE",
  "credits.thanks.ai": "CLAUDE (ANTHROPIC) ET LUMO (PROTON),\nPOUR L'ASSISTANCE AU DÉVELOPPEMENT",
  "credits.tech": "TECHNOLOGIES",
  "credits.qr": "QR CODE : KAZUHIKO ARASE",
  "credits.end": "MERCI D'AVOIR JOUÉ !",

  // --- Carte de partage (image) ---
  "card.score": "SCORE",
  "card.wave": "VAGUE ATTEINTE",
  "card.kills": "ENNEMIS ABATTUS",
  "card.graze": "MEILLEURE CHAÎNE\nDE FRÔLEMENTS",
  "card.distance": "ANNÉES-LUMIÈRE\nPARCOURUES",
  "card.challenge": "Tente de battre ce score :",
};
