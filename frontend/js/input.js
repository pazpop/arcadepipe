// Entrées clavier, souris et tactile unifiées : le reste du jeu lit `input.x/y`
// (position visée, en coordonnées logiques), `input.fireHeld` et
// `input.justPressed` (touches qui viennent d'être enfoncées).
import { RES_W, RES_H, INPUT, PLAYER } from "./config.js";

// Client (souris/tactile) -> coordonnées logiques internes (RES_W x RES_H),
// bornées aux limites du canvas. Partagé par la visée (ci-dessous) et le tap
// générique (menu/classement/crédits) dans main.js.
export function canvasToLogical(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = RES_W / rect.width;
  const scaleY = RES_H / rect.height;
  return {
    x: Math.max(0, Math.min(RES_W, (clientX - rect.left) * scaleX)),
    y: Math.max(0, Math.min(RES_H, (clientY - rect.top) * scaleY)),
  };
}

const SCROLL_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export function createInput(canvas) {
  const input = {
    x: PLAYER.restX,
    y: RES_H / 2,
    isTouch: false,
    fireHeld: false,
    autoFire: false, // bascule UI (case à cocher) — tir permanent sans avoir à maintenir
    justPressed: new Set(), // vidé à chaque frame par game.js
  };

  // Espace et les flèches feraient aussi défiler la page autour du jeu
  // (itch.io) : empêché, sauf dans un champ ou sur un curseur du panneau.
  // e.repeat : une touche maintenue ne compte qu'une fois.
  window.addEventListener("keydown", (e) => {
    if (e.target === document.body && SCROLL_KEYS.includes(e.code)) e.preventDefault();
    if (!e.repeat) input.justPressed.add(e.code);
  });

  canvas.addEventListener("mousemove", (e) => {
    if (input.isTouch) return;
    const p = canvasToLogical(canvas, e.clientX, e.clientY);
    input.x = p.x;
    input.y = p.y;
  });
  canvas.addEventListener("mousedown", () => {
    input.isTouch = false;
    input.fireHeld = true;
  });
  window.addEventListener("mouseup", () => (input.fireHeld = false));

  // Tactile : le doigt pilote le vaisseau, décalé vers l'avant (droite)
  // plutôt que caché sous le doigt. `touch-action: none` (CSS) empêche le
  // scroll/zoom pendant qu'on joue.
  function handleTouch(e) {
    if (e.touches.length === 0) return;
    input.isTouch = true;
    input.fireHeld = true;
    const t = e.touches[0];
    const p = canvasToLogical(canvas, t.clientX, t.clientY);
    input.x = Math.max(0, Math.min(RES_W, p.x + INPUT.touchXOffset));
    input.y = p.y;
  }
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      handleTouch(e);
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      handleTouch(e);
    },
    { passive: false }
  );
  // Doigt levé, ou geste annulé par le système (notification, geste d'accueil).
  function handleTouchEnd(e) {
    e.preventDefault();
    if (e.touches.length === 0) input.fireHeld = false;
  }
  canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });

  return input;
}

export function consumeJustPressed(input, code) {
  const had = input.justPressed.has(code);
  input.justPressed.delete(code);
  return had;
}

export function clearJustPressed(input) {
  input.justPressed.clear();
}
