// Désature une couleur en mélangeant chaque canal vers sa clarté perçue
// (équivalent à réduire la saturation HSL en gardant la luminosité) — utilisé
// partout où une couleur de gameplay doit paraître "plus terne" sans changer
// de teinte : particules (particles.js) et sprites endommagés (assets.js).
export function desaturate(hex, amount = 0.55) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  const toByte = (c) =>
    Math.round(Math.min(1, Math.max(0, c + (l - c) * amount)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}
