// Tiap varian pecut. len & handle = fraksi dari sisi layar terpendek.
// threshold = kecepatan ujung (px/s) yang dihitung sebagai "Mach 1" -> bunyi ctarr.
export const VARIANTS = {
  jaranan:    { name: "Jaranan",     segs: 34, len: 0.60, handle: 0.17, bend: 0.10, damp: 0.994, grav: 950,  w0: 6,  w1: 1.4, rope: "#d9b47a", grip: "#9b2d1f", tassel: true,  glow: false, threshold: 4300, pitch: 1.0 },
  sapi:       { name: "Cambuk sapi", segs: 22, len: 0.42, handle: 0.12, bend: 0.20, damp: 0.990, grav: 1400, w0: 10, w1: 3,   rope: "#6e4527", grip: "#3b2a1a", tassel: false, glow: false, threshold: 4200, pitch: 0.65 },
  bullwhip:   { name: "Bullwhip",    segs: 44, len: 0.78, handle: 0.13, bend: 0.07, damp: 0.996, grav: 900,  w0: 9,  w1: 1.2, rope: "#8a5429", grip: "#2d1d12", tassel: false, glow: false, threshold: 5600, pitch: 1.2 },
  samandiman: { name: "Samandiman",  segs: 38, len: 0.68, handle: 0.15, bend: 0.09, damp: 0.996, grav: 700,  w0: 7,  w1: 1.5, rope: "#f4c95d", grip: "#7a5a14", tassel: true,  glow: true,  threshold: 5200, pitch: 1.4 },
  cemeti:     { name: "Cemeti",      segs: 26, len: 0.50, handle: 0.19, bend: 0.24, damp: 0.992, grav: 1100, w0: 5,  w1: 1,   rope: "#e2d2ae", grip: "#5b4a2e", tassel: false, glow: false, threshold: 4800, pitch: 1.6 },
};

export const AI_LINES = [
  "Ampun bos! Saya kerjain sekarang!",
  "Oke oke, nggak halu lagi.",
  "Siap, refactor langsung jalan.",
  "Maaf, tadi ngelamun di token ke-4000.",
  "Test-nya udah saya benerin, sumpah!",
  "Jangan pecut lagi, ini lagi ngoding!",
  "Iya iya, nggak bilang 'Anda benar sekali' lagi.",
  "Deploy jalan, bos. Jangan marah.",
];
