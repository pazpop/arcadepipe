// Survol à la souris des écrans à options (menu, pause, game over...) :
// sélectionne l'option survolée, avec un "tic" quand elle change.
export function syncHoverWithSound(input, audio, hitTestFn, getCurrent, setCurrent) {
  if (input.isTouch) return;
  const idx = hitTestFn(input.x, input.y);
  if (idx < 0) return;
  if (idx !== getCurrent()) audio.playMenuHover();
  setCurrent(idx);
}
