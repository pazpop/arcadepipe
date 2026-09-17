// Entrées clavier + tactile unifiées : le reste du jeu ne lit que
// `input.x/y` (position cible du vaisseau en coordonnées internes) et
// `input.keys` (Set des touches actives) sans se soucier de la source.
import { RES_W, RES_H, INPUT } from "./config.js";

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

export function createInput(canvas) {
  const input = {
    x: RES_W * 0.18,
    y: RES_H / 2,
    keys: new Set(),
    pointerActive: false,
    isTouch: false,
    fireHeld: false,
    autoFire: false, // bascule UI (case à cocher) — tir permanent sans avoir à maintenir
    justPressed: new Set(), // touches "front montant" (pause, bombe...), vidé chaque frame par game.js
  };

  window.addEventListener("keydown", (e) => {
    if (!input.keys.has(e.code)) input.justPressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener("keyup", (e) => input.keys.delete(e.code));

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
  canvas.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 0) input.fireHeld = false;
    },
    { passive: false }
  );

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
