// Préférences dans localStorage. Stockage bloqué (navigation privée, jeu
// embarqué dans une autre page avec les cookies tiers refusés) : elles sont
// gardées en mémoire, le temps de la visite. Jamais bloquant.
const memory = new Map();

export function loadItem(key) {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function saveItem(key, value) {
  memory.set(key, String(value));
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* stockage indisponible : la valeur reste en mémoire */
  }
}

// Nombre dans [0, 1] (volumes) ; `fallback` si absent ou invalide.
export function loadUnitFloat(key, fallback) {
  const v = parseFloat(loadItem(key));
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}
