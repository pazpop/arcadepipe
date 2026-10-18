// Canvas rendu à la résolution réelle de l'écran, alors que tout le jeu dessine
// en coordonnées logiques RES_W x RES_H : `scale` fait la conversion. Dessiné
// en 480x270 puis agrandi, un texte de 7 px n'aurait que 7 pixels de haut.
import { RES_W, RES_H } from "./config.js";

// Densité plafonnée à 2 (un écran à 3 rendrait 2,25 fois plus de
// pixels pour un gain invisible) ; à baisser si un appareil rame.
const MAX_PIXEL_RATIO = 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let scale = 1;

  // shadowBlur (les halos) est le seul réglage du canvas que la mise à l'échelle
  // n'agrandit pas : il est multiplié ici, une fois pour tout le jeu.
  const shadowBlur = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), "shadowBlur");
  Object.defineProperty(ctx, "shadowBlur", {
    get() {
      return shadowBlur.get.call(this) / scale;
    },
    set(blur) {
      shadowBlur.set.call(this, blur * scale);
    },
  });

  // Le canvas occupe le plus grand rectangle 16:9 qui tient dans la fenêtre.
  function resize() {
    const width = Math.floor(Math.min(window.innerWidth, (window.innerHeight * RES_W) / RES_H));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${Math.floor((width * RES_H) / RES_W)}px`;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const pixelWidth = Math.max(RES_W, Math.round(width * pixelRatio));
    // Changer width/height efface le canvas et remet le contexte à zéro : à
    // faire seulement si la taille change, en rétablissant imageSmoothingEnabled
    // (sinon les sprites sont lissés en taches floues).
    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
      canvas.height = Math.round((pixelWidth * RES_H) / RES_W);
      ctx.imageSmoothingEnabled = false;
    }
    scale = canvas.width / RES_W;
  }
  window.addEventListener("resize", resize);
  resize();

  return {
    ctx,
    // À appeler avant chaque dessin de frame.
    applyScale() {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    },
  };
}
