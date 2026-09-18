// localStorage tolérant : stockage indisponible (navigation privée, accès
// bloqué) -> lecture = null/repli, écriture ignorée. Jamais bloquant.
export function loadItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveItem(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* indisponible — pas bloquant */
  }
}

// Nombre dans [0, 1] (volumes) ; `fallback` si absent ou invalide.
export function loadUnitFloat(key, fallback) {
  const v = parseFloat(loadItem(key));
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}
