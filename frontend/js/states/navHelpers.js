// Survol à la souris des écrans à options (menu, pause, game over...) :
// sélectionne l'option survolée, avec un "tic" quand elle change. Seulement
// quand la souris bouge : immobile sur une option, elle ne doit pas reprendre
// la sélection faite aux flèches du clavier.
let lastX = null;
let lastY = null;

export function syncHoverWithSound(input, audio, hitTestFn, getCurrent, setCurrent) {
  if (input.isTouch || (input.x === lastX && input.y === lastY)) return;
  lastX = input.x;
  lastY = input.y;
  const idx = hitTestFn(input.x, input.y);
  if (idx < 0) return;
  if (idx !== getCurrent()) audio.playMenuHover();
  setCurrent(idx);
}
