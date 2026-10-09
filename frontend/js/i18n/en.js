// English — same keys as fr.js (the reference file), checked by i18n.test.js.
// {name} is replaced by a value at display time: keep it as is.
export default {
  // Flags of the button that offers this language: one name per flag, drawn
  // by the .flag-<name> class in css/style.css.
  "lang.flags": "us gb",

  // --- Settings panel (HTML, bottom left) ---
  "panel.pause.title": "Pause",
  "panel.music": "MUSIC (by Mall-E)",
  "panel.music.stop": "Stop / play",
  "panel.music.next": "Next track",
  "panel.music.volume": "Music volume",
  "panel.sfx": "SOUND EFFECTS",
  "panel.sfx.volume": "Sound effects volume",
  "panel.speed": "GAME SPEED",
  "panel.speed.title": "Game speed (does not affect music or sound effects)",
  "panel.autofire": "Auto-fire",
  "panel.crt": "Retro filter",
  "panel.help": "Help",
  "panel.fullscreen": "Fullscreen",
  "panel.fullscreen.exit": "Exit fullscreen",
  "panel.cookies": "Cookies",
  "panel.cookies.title": "Change my cookie preferences",
  "panel.lang.title": "Change language",
  "panel.privacy": "Privacy",
  "panel.toggle.title": "Settings",
  "nova.title": "Trigger NOVA (Space)",
  "share.button": "📤 Share",
  "share.title": "Generate an image to share",
  "share.done": "✅ Image downloaded",

  // --- Consent banner ---
  "cookie.aria": "Cookie consent",
  "cookie.text": "Allow Google Analytics (analytics cookies)? It is used to count visits.",
  "cookie.more": "Learn more",
  "cookie.accept": "Accept",
  "cookie.decline": "Decline",

  // --- Main menu ---
  "menu.lore": "The galaxy is falling to enemy fleets —\nalone at the controls of the last free fighter,\nyou are its last hope.",
  "menu.play": "PLAY",
  "menu.leaderboard": "LEADERBOARD",
  "menu.help": "HELP",
  "menu.credits": "CREDITS",

  // --- In-game HUD ---
  "hud.score": "SCORE {score}",
  "hud.wave": "WAVE {wave}",
  "hud.bonusLevel": "BONUS LEVEL — RINGS {passed}/{total}",
  "hud.intact": "NO DAMAGE +{bonus}",
  "hud.controlHint": "HOLD CLICK / TOUCH TO FIRE",
  "bonus.intro.title": "BONUS LEVEL UNLOCKED!",
  "bonus.intro.line1": "Your score unlocked it",
  "bonus.intro.line2": "Fly through the rings to charge your NOVA gauge!",

  // --- Banners ---
  "banner.bossWave": "WAVE {wave} — MASSIVE WEAPON INCOMING",
  "banner.waveDone": "WAVE {wave} CLEARED",
  "banner.waveDoneIntact": "WAVE {wave} CLEARED — NO DAMAGE! +{bonus}",
  "banner.bonusDone": "BONUS LEVEL COMPLETE: {passed}/{total} RINGS — NOVA +{percent}%",
  "banner.nova": "NOVA!",

  // --- Power-ups ---
  "powerup.power": "POWER",
  "powerup.power.effect": "more damage, slower fire",
  "powerup.rapid": "RAPID FIRE",
  "powerup.rapid.effect": "very fast fire, less damage",
  "powerup.shotgun": "SHOTGUN",
  "powerup.shotgun.effect": "cone of pellets, damage falls off with distance",
  "powerup.shield": "SHIELD",
  "powerup.shield.effect": "absorbs incoming hits",

  // --- Pause ---
  "pause.title": "PAUSED",
  "pause.resume": "RESUME",
  "pause.menu": "MAIN MENU",
  "quit.title": "QUIT THIS RUN?",
  "quit.warning": "YOUR CURRENT PROGRESS WILL BE LOST.",
  "quit.yes": "YES, QUIT",
  "quit.no": "NO, KEEP PLAYING",

  // --- Help ---
  "help.title": "HELP",
  "help.title.bonus": "HELP — POWER-UPS",
  "help.title.enemies": "HELP — ENEMIES",
  "help.move": "MOVEMENT",
  "help.move.detail": "Mouse or finger: steer the ship",
  "help.fire": "FIRE",
  "help.fire.detail": 'Automatic. Uncheck "Auto-fire" (bottom left) to fire only while you hold the mouse button or keep a finger down',
  "help.nova": "NOVA",
  "help.nova.detail":
    "Graze (without touching) an enemy shot or an enemy ship — not the boss — to charge the NOVA gauge at the top left: take risks! Once full, SPACE (or the touch button at the bottom right) destroys every enemy on screen and their shots, never the boss. Up to 2 charges in reserve from the 2nd boss fight (only 1 before). Use them whenever you like.",
  "help.boss": "BOSS",
  "help.boss.detail": "Aim for the YELLOW weak points, avoid its hull — defeating it grants +1 life",
  "help.music": "MUSIC",
  "help.music.detail": "Shuffled playlist, adjustable at the bottom left",
  "help.keys": "KEYBOARD SHORTCUTS",
  "help.keys.detail": "Esc/P: pause · Space: NOVA · M: mute",
  "help.prev": "◀ PREV.",
  "help.next": "NEXT ▶",
  "help.continue": "▶ CONTINUE",
  "enemy.normal": "EASY — 1 HP, no shots, straight line",
  "enemy.gunner": "MEDIUM — 2 HP, aimed shots (wave 6+)",
  "enemy.elite": "ELITE — 3 HP, aimed shots, weaves (wave 3+)",
  "enemy.kamikaze": "KAMIKAZE — 1 HP, charges at you (wave 4+)",

  // --- End of run ---
  "gameover.title": "GAME OVER",
  "gameover.stats": "SCORE {score}  ·  WAVE {wave}  ·  {kills} KILLS",
  "gameover.distance": "{distance} LIGHT-YEARS TRAVELED",
  "gameover.replay": "PLAY AGAIN",
  "gameover.enterName": "ENTER YOUR NAME",
  "gameover.top": "YOU MADE THE TOP {size}!",
  "name.title": "YOU MADE THE LEADERBOARD!",
  "name.prompt": "ENTER YOUR NAME (8 CHARS MAX)",
  "name.validate": "▶ CONFIRM",

  // --- Leaderboard ---
  "board.games": "GAMES PLAYED: {count}",
  "board.rank": "RANK",
  "board.name": "NAME",
  "board.score": "SCORE",
  "board.wave": "WAVE",
  "board.kills": "KILLS",
  "board.empty": "No scores yet.",
  "board.error": "Leaderboard unavailable right now.",
  "board.back": "ESC / TAP — BACK",

  // --- Credits ---
  "credits.by": "A GAME BY PAZPOP",
  "credits.source": "SOURCE CODE",
  "credits.music": "MUSIC",
  "credits.thanks": "SPECIAL THANKS",
  "credits.thanks.music": "MALL-E, FOR THE MUSIC",
  "credits.thanks.ai": "CLAUDE (ANTHROPIC) AND LUMO (PROTON),\nFOR DEVELOPMENT ASSISTANCE",
  "credits.tech": "TECHNOLOGIES",
  "credits.qr": "QR CODE: KAZUHIKO ARASE",
  "credits.end": "THANKS FOR PLAYING!",

  // --- Share card (image) ---
  "card.score": "SCORE",
  "card.wave": "WAVE REACHED",
  "card.kills": "ENEMIES DESTROYED",
  "card.graze": "BEST GRAZE\nCHAIN",
  "card.distance": "LIGHT-YEARS\nTRAVELED",
  "card.challenge": "Try to beat this score:",
};
