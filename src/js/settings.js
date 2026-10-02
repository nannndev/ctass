// Pengaturan Ctas: pecut yang dipilih + custom per pecut.
// Disimpan Rust di file (app desktop) atau localStorage (versi browser).
import { VARIANTS } from "./variants.js";
import { detectLang } from "./i18n.js";

export const DEFAULTS = {
  variant: "jaranan",
  mode: "follow",  // "follow" = pecut nempel di kursor, "click" = klik buat nyabet titik itu
  home: null,      // mode klik: posisi pecut nongkrong { x, y } dalam pecahan layar (null = pojok kanan)
  showWord: true,  // tampilkan tulisan pas ctarr
  view: "2d",      // "2d" / "3d" (3D baru buat pecut yang punya versi 3D, sisanya tetap 2D)
  lang: null,      // "id" / "en" (null = ikut bahasa sistem)
  sensitivity: 1, // pengali batas Mach 1. Kecil = lebih gampang bunyi
  volume: 1,
  nag: false,
  autosend: false,
  theme: "classic", // "classic" (gelap elegan) / "future" (neon futuristik)
  custom: {},     // { [key pecut]: { len, bend, grav, rope, grip, sound, fx, word, echo, room, pitch, file } }
                  // sound = key pecut lain, atau "file" = suara sendiri (file: { id, name, start, end, gain })
};

// Batas slider custom
export const RANGES = {
  len: [0.6, 1.5, 0.05],   // pengali panjang
  bend: [0.03, 0.4, 0.01], // kekakuan
  grav: [0.5, 1.6, 0.05],  // pengali berat
  sensitivity: [0.6, 1.4, 0.05],
  volume: [0, 1.5, 0.05],
  echo: [0, 0.8, 0.02],    // level gema jauh
  room: [0, 0.9, 0.02],    // banyaknya reverb ruangan
  pitch: [0.5, 1.8, 0.05], // pengali nada
  fgain: [0, 2.5, 0.05],   // volume suara sendiri
};

export function normalize(raw) {
  const s = { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
  if (!VARIANTS[s.variant]) s.variant = DEFAULTS.variant;
  if (s.mode !== "click") s.mode = "follow";
  if (s.lang !== "id" && s.lang !== "en") s.lang = detectLang();
  if (!s.home || !isFinite(s.home.x) || !isFinite(s.home.y)) s.home = null;
  s.showWord = s.showWord !== false;
  s.view = s.view === "3d" ? "3d" : "2d";
  s.theme = s.theme === "future" ? "future" : "classic";
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
  v.sound = { ...(c.sound && VARIANTS[c.sound] ? VARIANTS[c.sound].sound : base.sound) };
  if (c.sound === "file" && c.file?.id) v.sound.file = { ...c.file };
  if (c.echo != null) v.sound.echo = c.echo > 0 ? [v.sound.echo?.[0] ?? 0.26, v.sound.echo?.[1] ?? 0.3, c.echo] : null;
  if (c.room != null) v.sound.wet = c.room;
  if (c.pitch) v.sound.pitch = c.pitch;
  if (c.fx && VARIANTS[c.fx]) {
    const f = VARIANTS[c.fx];
    Object.assign(v, { fx: f.fx, word: f.word, color: f.color, shake: f.shake });
  }
  if (c.word) v.word = String(c.word).slice(0, 16);
  // pecut lebih panjang ujungnya lebih cepat, jadi batasnya ikut naik biar rasanya sama
  v.threshold = base.threshold * (c.len ? Math.sqrt(c.len) : 1) * s.sensitivity;
  return v;
}
