// Tiap varian pecut. len & handle = fraksi dari sisi layar terpendek.
// threshold = kecepatan ujung (px/s) yang dihitung sebagai "Mach 1" -> bunyi ctarr.
//
// sound: resep suara ctarr (lihat audio.js)
//   nDur   panjang gelombang N sonic boom (detik). Pendek = tajam, panjang = berat
//   snap   panjang letupan noise
//   tail   panjang desis sisa udara, tailLevel kerasnya
//   rate   kecepatan playback (nada), body = dentum rendah [frek awal, frek akhir, durasi, gain]
//   wet    banyaknya gema ruangan, echo = pantulan jauh [jeda, feedback, level] atau null
//   extra  lapisan khas: "rustle" (rumbai), "chime" (denting sakti), "double" (tsik-tsik)
//   gain   pengali volume (nada tinggi kedengeran lebih tipis)
//
// fx: efek visual khas pas ctarr, word = tulisan yang muncul, shake = kuatnya layar goyang
export const VARIANTS = {
  jaranan: {
    name: "Jaranan", segs: 34, len: 0.60, handle: 0.17, bend: 0.10, damp: 0.994, grav: 950, w0: 6, w1: 1.4,
    rope: "#d9b47a", grip: "#9b2d1f", tassel: true, glow: false, threshold: 4300,
    sound: { nDur: 0.0011, snap: 0.0025, tail: 0.02, tailLevel: 0.35, rate: 1, body: [160, 55, 0.08, 0.5], wet: 0.3, echo: [0.12, 0.3, 0.35], extra: "rustle" },
    fx: "confetti", word: "CTARR!", color: "#e2775a", shake: 1,
  },
  sapi: {
    name: "Cambuk sapi", segs: 22, len: 0.42, handle: 0.12, bend: 0.20, damp: 0.990, grav: 1400, w0: 10, w1: 3,
    rope: "#6e4527", grip: "#3b2a1a", tassel: false, glow: false, threshold: 4200,
    sound: { nDur: 0.0026, snap: 0.0045, tail: 0.032, tailLevel: 0.55, rate: 0.72, body: [120, 38, 0.16, 1.1], wet: 0.16, echo: null, extra: null },
    fx: "dust", word: "DHUAR!", color: "#c9a27a", shake: 1.8,
  },
  bullwhip: {
    name: "Bullwhip", segs: 44, len: 0.78, handle: 0.13, bend: 0.07, damp: 0.996, grav: 900, w0: 9, w1: 1.2,
    rope: "#8a5429", grip: "#2d1d12", tassel: false, glow: false, threshold: 5600,
    sound: { nDur: 0.0006, snap: 0.0015, tail: 0.012, tailLevel: 0.25, rate: 1.15, body: [220, 70, 0.05, 0.35], wet: 0.24, echo: [0.34, 0.4, 0.5], extra: null },
    fx: "shock", word: "CRACK!", color: "#ece8e1", shake: 1.3,
  },
  samandiman: {
    name: "Samandiman", segs: 38, len: 0.68, handle: 0.15, bend: 0.09, damp: 0.996, grav: 700, w0: 7, w1: 1.5,
    rope: "#f4c95d", grip: "#7a5a14", tassel: true, glow: true, threshold: 5200,
    sound: { nDur: 0.001, snap: 0.0025, tail: 0.02, tailLevel: 0.3, rate: 1.05, body: [150, 50, 0.09, 0.45], wet: 0.55, echo: [0.2, 0.32, 0.25], extra: "chime", gain: 1.3 },
    fx: "magic", word: "CTARR!", color: "#f4c95d", shake: 1.1,
  },
  cemeti: {
    name: "Cemeti", segs: 26, len: 0.50, handle: 0.19, bend: 0.24, damp: 0.992, grav: 1100, w0: 5, w1: 1,
    rope: "#e2d2ae", grip: "#5b4a2e", tassel: false, glow: false, threshold: 4800,
    sound: { nDur: 0.0005, snap: 0.0011, tail: 0.007, tailLevel: 0.18, rate: 1.55, body: [320, 130, 0.03, 0.18], wet: 0.12, echo: null, extra: "double", gain: 1.9 },
    fx: "star", word: "tsik!", color: "#ece8e1", shake: 0.35,
  },
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
