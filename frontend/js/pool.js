// Emplacement libre dans un pool d'objets à taille fixe (particules,
// projectiles, ennemis, bonus) — pas d'allocation pendant la boucle de jeu.
// Le même "trouve le premier item inactif" était dupliqué dans chacun de ces
// modules ; factorisé ici, chacun garde ses propres champs à initialiser.
export function acquireSlot(pool) {
  for (const item of pool.items) {
    if (!item.active) return item;
  }
  return null; // pool saturé : on ignore silencieusement plutôt que de faire grandir le tableau
}
