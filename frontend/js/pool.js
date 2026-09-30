// Emplacement libre dans un pool d'objets à taille fixe (particules,
// projectiles, ennemis, bonus) — pas d'allocation pendant la boucle de jeu.
// Chaque module initialise lui-même les champs de l'emplacement obtenu.
export function acquireSlot(pool) {
  for (const item of pool.items) {
    if (!item.active) return item;
  }
  return null; // pool saturé : on ignore silencieusement plutôt que de faire grandir le tableau
}
