// Petits utilitaires de survol clavier/souris partagés par plusieurs écrans
// à options (menu, pause, confirmation de sortie, "continuer" après un game
// over) — le même geste répété à chaque écran, factorisé une seule fois.
export function syncHover(input, hitTestFn, apply) {
  if (input.isTouch) return;
  const idx = hitTestFn(input.x, input.y);
  if (idx >= 0) apply(idx);
}

// Comme syncHover, mais joue un "tic" seulement quand le survol change
// d'item (pas à chaque frame). Réservé aux écrans à plusieurs options.
export function syncHoverWithSound(input, audio, hitTestFn, getCurrent, setCurrent) {
  if (input.isTouch) return;
  const idx = hitTestFn(input.x, input.y);
  if (idx < 0) return;
  if (idx !== getCurrent()) audio.playMenuHover();
  setCurrent(idx);
}
