// Survol clavier/souris partagé par les écrans à options (menu, pause,
// confirmation de sortie, game over) — le même geste répété à chaque écran,
// factorisé une seule fois. Joue un "tic" seulement quand le survol change
// d'item (pas à chaque frame).
export function syncHoverWithSound(input, audio, hitTestFn, getCurrent, setCurrent) {
  if (input.isTouch) return;
  const idx = hitTestFn(input.x, input.y);
  if (idx < 0) return;
  if (idx !== getCurrent()) audio.playMenuHover();
  setCurrent(idx);
}
