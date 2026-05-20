const ESC = "\x1b[";
const RESET = `${ESC}0m`;

const wrap = (open) => (s) => `${ESC}${open}m${s}${RESET}`;
const fg256 = (n) => (s) => `${ESC}38;5;${n}m${s}${RESET}`;
const rgb = (r, g, b) => (s) => `${ESC}38;2;${r};${g};${b}m${s}${RESET}`;
const bgRgb = (r, g, b) => (s) => `${ESC}48;2;${r};${g};${b}m${s}${RESET}`;

const c = {
  reset: RESET,
  bold: wrap(1),
  dim: wrap(2),
  italic: wrap(3),
  underline: wrap(4),
  blink: wrap(5),
  inverse: wrap(7),

  black: wrap(30),
  red: wrap(31),
  green: wrap(32),
  yellow: wrap(33),
  blue: wrap(34),
  magenta: wrap(35),
  cyan: wrap(36),
  white: wrap(37),
  gray: wrap(90),

  neonCyan: fg256(51),
  neonAqua: fg256(45),
  neonGreen: fg256(46),
  neonLime: fg256(118),
  neonYellow: fg256(226),
  neonOrange: fg256(208),
  neonPink: fg256(201),
  neonPurple: fg256(135),
  neonBlue: fg256(39),
  steel: fg256(67),
  silver: fg256(252),

  rgb,
  bgRgb,
  fg256,
};

function strip(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, "");
}

function visibleLen(str) {
  return strip(str).length;
}

function gradient(text, [r1, g1, b1], [r2, g2, b2]) {
  const len = Math.max(text.length - 1, 1);
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const t = i / len;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    out += rgb(r, g, b)(text[i]);
  }
  return out;
}

module.exports = { c, strip, visibleLen, gradient };
