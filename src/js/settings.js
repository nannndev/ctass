// Pengaturan Ctas: pecut yang dipilih + custom per pecut.
// Disimpan Rust di file (app desktop) atau localStorage (versi browser).
import { VARIANTS } from "./variants.js";

export const DEFAULTS = {
  variant: "jaranan",
  sensitivity: 1, // pengali batas Mach 1. Kecil = lebih gampang bunyi
  volume: 1,
  nag: false,
  autosend: false,
  custom: {},     // { [key pecut]: { len, bend, grav, rope, grip, sound, fx, word } }
};

// Batas slider custom
export const RANGES = {
  len: [0.6, 1.5, 0.05],   // pengali panjang
  bend: [0.03, 0.4, 0.01], // kekakuan
  grav: [0.5, 1.6, 0.05],  // pengali berat
  sensitivity: [0.6, 1.4, 0.05],
  volume: [0, 1.5, 0.05],
};

export function normalize(raw) {
  const s = { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
  if (!VARIANTS[s.variant]) s.variant = DEFAULTS.variant;
  if (!s.custom || typeof s.custom !== "object") s.custom = {};
  return s;
}

// Pecut jadi: varian dasar + custom + sensitivitas
export function effective(settings) {
  const s = normalize(settings);
  const base = VARIANTS[s.variant];
  const c = s.custom[s.variant] || {};
  const v = { ...base };
  if (c.len) v.len = base.len * c.len;
  if (c.bend != null) v.bend = c.bend;
  if (c.grav) v.grav = base.grav * c.grav;
  if (c.rope) v.rope = c.rope;
  if (c.grip) v.grip = c.grip;
  if (c.sound && VARIANTS[c.sound]) v.sound = VARIANTS[c.sound].sound;
  if (c.fx && VARIANTS[c.fx]) {
    const f = VARIANTS[c.fx];
    Object.assign(v, { fx: f.fx, word: f.word, color: f.color, shake: f.shake });
  }
  if (c.word) v.word = String(c.word).slice(0, 16);
  // pecut lebih panjang ujungnya lebih cepat, jadi batasnya ikut naik biar rasanya sama
  v.threshold = base.threshold * (c.len ? Math.sqrt(c.len) : 1) * s.sensitivity;
  return v;
}
