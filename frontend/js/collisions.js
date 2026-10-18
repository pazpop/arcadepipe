// Collisions cercle-cercle uniquement — plus indulgent et plus lisible pour
// du danmaku qu'un rectangle, surtout sur la hitbox réduite du joueur.
export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}
