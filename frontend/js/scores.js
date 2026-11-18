// Classement local : les meilleurs scores et le nombre de parties de cet appareil, gardés dans le navigateur
// (storage.js). Rien ne part sur un serveur.
import { STORAGE_KEYS } from "./config.js";
import { loadItem, saveItem } from "./storage.js";

// Taille du classement affiché, et seuil pour y entrer.
export const TOP_SIZE = 10;

// Du meilleur au moins bon. Une liste illisible (modifiée à la main) donne un classement vide plutôt qu'une erreur.
export function topScores() {
  try {
    const list = JSON.parse(loadItem(STORAGE_KEYS.scores));
    return Array.isArray(list) ? list.slice(0, TOP_SIZE) : [];
  } catch {
    return [];
  }
}

// Le score entre-t-il dans le top ? Jamais un score nul.
export function qualifies(score) {
  const top = topScores();
  return score > 0 && (top.length < TOP_SIZE || score > top.at(-1).score);
}

// sort est stable : à égalité, le premier arrivé reste devant.
export function addScore(player_name, score, wave, kills) {
  const top = [...topScores(), { player_name, score, wave, kills }].sort((a, b) => b.score - a.score);
  saveItem(STORAGE_KEYS.scores, JSON.stringify(top.slice(0, TOP_SIZE)));
}

export function gamesPlayed() {
  return Number(loadItem(STORAGE_KEYS.gamesPlayed)) || 0;
}

export function recordGamePlayed() {
  saveItem(STORAGE_KEYS.gamesPlayed, gamesPlayed() + 1);
}
