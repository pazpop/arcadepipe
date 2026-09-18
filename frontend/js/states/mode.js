// Liste des états de la machine à états du jeu — dans son propre fichier
// (pas dans game.js) pour que les modules de states/ puissent s'y référer
// sans dépendre en retour de game.js (ça créerait une boucle d'import).
export const MODE = {
  MENU: "menu",
  PLAYING: "playing",
  PAUSED: "paused",
  HELP: "help",
  GAME_OVER: "game_over",
  NAME_ENTRY: "name_entry",
  LEADERBOARD: "leaderboard",
  CREDITS: "credits",
};
