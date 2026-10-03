// Tiap varian pecut. len & handle = fraksi dari sisi layar terpendek.
// threshold = kecepatan ujung (px/s) yang dihitung sebagai "Mach 1" -> bunyi ctarr.
//
// sound: resep suara ctarr (lihat audio.js)
//   nDur   panjang gelombang N sonic boom (detik). Pendek = tajam, panjang = berat
//   snap   panjang letupan noise
//   tail   panjang desis sisa udara, tailLevel kerasnya
//   rate   kecepatan playback (nada), body = dentum rendah [frek awal, frek akhir, durasi, gain]
//   wet    banyaknya gema ruangan, echo = pantulan jauh [jeda, feedback, level] atau null
//   extra  lapisan khas: "rustle" (rumbai), "chime" (denting sakti), "double" (tsik-tsik),
//          "swish", "zap", "slap", "flame", "laser" (dengung plasma), "glitch", "metal", "chain",
//          "crackle", "void", "arp", "servo"
//   gain   pengali volume (nada tinggi kedengeran lebih tipis)
//
// fx: efek visual khas pas ctarr, word = tulisan yang muncul, shake = kuatnya layar goyang
// Bentuk khusus: strands (jumlah lidi), plug (colokan di ujung), flat + buckle (sabuk),
// glow (warna nyala), fire (bara ngikutin ujung), core (inti terang, plasma)
// Futuristik: holo (hologram kedip + glitch), chrome (logam cair beriak), chain (rantai + warna energinya),
// arcs (listrik loncat + warnanya), void (lubang hitam di ujung), fiber (denyut cahaya RGB), robot (ruas mekanik)
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
    rope: "#f4c95d", grip: "#7a5a14", tassel: true, glow: "#ffd36b", threshold: 5200,
    sound: { nDur: 0.001, snap: 0.0025, tail: 0.02, tailLevel: 0.3, rate: 1.05, body: [150, 50, 0.09, 0.45], wet: 0.55, echo: [0.2, 0.32, 0.25], extra: "chime", gain: 1.3 },
    fx: "magic", word: "CTARR!", color: "#f4c95d", shake: 1.1,
  },
  cemeti: {
    name: "Cemeti", segs: 26, len: 0.50, handle: 0.19, bend: 0.24, damp: 0.992, grav: 1100, w0: 5, w1: 1,
    rope: "#e2d2ae", grip: "#5b4a2e", tassel: false, glow: false, threshold: 4800,
    sound: { nDur: 0.0005, snap: 0.0011, tail: 0.007, tailLevel: 0.18, rate: 1.55, body: [320, 130, 0.03, 0.18], wet: 0.12, echo: null, extra: "double", gain: 1.9 },
    fx: "star", word: "tsik!", color: "#ece8e1", shake: 0.35,
  },
  sapulidi: {
    name: "Sapu lidi", segs: 18, len: 0.40, handle: 0.20, bend: 0.32, damp: 0.986, grav: 1300, w0: 2, w1: 1,
    rope: "#c8a96a", grip: "#6b4f2a", strands: 7, spread: 0.1, threshold: 3600,
    sound: { nDur: 0.0016, snap: 0.006, tail: 0.05, tailLevel: 0.75, rate: 0.9, body: [140, 60, 0.06, 0.25], wet: 0.15, echo: null, extra: "swish", gain: 1.4 },
    fx: "sticks", word: "SRAK!", color: "#c8a96a", shake: 0.8,
  },
  kabel: {
    name: "Kabel charger", segs: 30, len: 0.55, handle: 0.07, bend: 0.22, damp: 0.993, grav: 1000, w0: 3.2, w1: 3.2,
    rope: "#f2f2f0", grip: "#e6e6e3", plug: true, threshold: 4400,
    sound: { nDur: 0.0004, snap: 0.0008, tail: 0.004, tailLevel: 0.15, rate: 1.8, body: [260, 120, 0.03, 0.15], wet: 0.1, echo: null, extra: "zap", gain: 1.6 },
    fx: "zap", word: "ZZT!", color: "#7cc7ff", shake: 0.6,
  },
  sabuk: {
    name: "Ikat pinggang", segs: 20, len: 0.38, handle: 0.10, bend: 0.30, damp: 0.988, grav: 1300, w0: 9, w1: 9,
    rope: "#3a2a1e", grip: "#2a1d14", flat: true, buckle: true, threshold: 3900,
    sound: { nDur: 0.0018, snap: 0.003, tail: 0.015, tailLevel: 0.4, rate: 0.85, body: [180, 60, 0.1, 0.9], wet: 0.18, echo: null, extra: "slap" },
    fx: "impact", word: "PLAK!", color: "#f2c23a", shake: 1.5,
  },
  api: {
    name: "Cambuk api", segs: 40, len: 0.70, handle: 0.14, bend: 0.08, damp: 0.995, grav: 750, w0: 7, w1: 1.3,
    rope: "#ff7a2e", grip: "#3b1a0c", glow: "#ff6a1a", fire: true, threshold: 5000,
    sound: { nDur: 0.0009, snap: 0.0022, tail: 0.025, tailLevel: 0.35, rate: 1, body: [150, 45, 0.1, 0.55], wet: 0.35, echo: [0.16, 0.25, 0.2], extra: "flame", gain: 1.2 },
    fx: "fire", word: "BWOSH!", color: "#ff7a2e", shake: 1.2,
  },
  plasma: {
    name: "Cambuk plasma", segs: 36, len: 0.72, handle: 0.15, bend: 0.08, damp: 0.996, grav: 520, w0: 5, w1: 2.4,
    rope: "#4de3ff", grip: "#aeb9c7", glow: "#4de3ff", core: "#eafcff", threshold: 5000,
    sound: { nDur: 0.0005, snap: 0.0012, tail: 0.01, tailLevel: 0.2, rate: 1.3, body: [90, 40, 0.14, 0.6], wet: 0.4, echo: [0.22, 0.35, 0.3], extra: "laser", gain: 1.2 },
    fx: "pulse", word: "VZWAP!", color: "#4de3ff", shake: 1.1,
  },
  // ---------- futuristik ----------
  hologram: {
    name: "Cambuk hologram", segs: 34, len: 0.66, handle: 0.15, bend: 0.09, damp: 0.995, grav: 600, w0: 6, w1: 1.6,
    rope: "#7fd8ff", grip: "#26304a", glow: "#8a7dff", holo: true, threshold: 4900,
    sound: { nDur: 0.0006, snap: 0.0014, tail: 0.012, tailLevel: 0.2, rate: 1.25, body: [110, 50, 0.08, 0.35], wet: 0.35, echo: [0.09, 0.35, 0.25], extra: "glitch", gain: 1.2 },
    fx: "glitch", word: "BZZRT!", color: "#8a7dff", shake: 0.9,
  },
  chrome: {
    name: "Cambuk logam cair", segs: 36, len: 0.68, handle: 0.14, bend: 0.10, damp: 0.995, grav: 1000, w0: 7, w1: 2.2,
    rope: "#cfd6de", grip: "#59616b", chrome: true, threshold: 5000,
    sound: { nDur: 0.0008, snap: 0.002, tail: 0.015, tailLevel: 0.25, rate: 1.1, body: [180, 70, 0.07, 0.4], wet: 0.3, echo: [0.18, 0.3, 0.25], extra: "metal", gain: 1.1 },
    fx: "droplets", word: "SHHING!", color: "#e6edf3", shake: 1,
  },
  rantai: {
    name: "Rantai energi", segs: 28, len: 0.60, handle: 0.13, bend: 0.05, damp: 0.993, grav: 1500, w0: 6, w1: 5,
    rope: "#8b939d", grip: "#2b2f36", chain: "#ffb02e", threshold: 4400,
    sound: { nDur: 0.0014, snap: 0.003, tail: 0.02, tailLevel: 0.35, rate: 0.9, body: [140, 50, 0.12, 0.7], wet: 0.25, echo: [0.2, 0.3, 0.2], extra: "chain", gain: 1.1 },
    fx: "energy", word: "KLANGG!", color: "#ffb02e", shake: 1.4,
  },
  tesla: {
    name: "Cambuk tesla", segs: 34, len: 0.66, handle: 0.16, bend: 0.09, damp: 0.995, grav: 850, w0: 6, w1: 1.8,
    rope: "#34405e", grip: "#b87333", arcs: "#9fd4ff", threshold: 4900,
    sound: { nDur: 0.0005, snap: 0.001, tail: 0.008, tailLevel: 0.2, rate: 1.4, body: [120, 60, 0.05, 0.3], wet: 0.2, echo: null, extra: "crackle", gain: 1.3 },
    fx: "lightning", word: "KRZZAK!", color: "#9fd4ff", shake: 1.2,
  },
  blackhole: {
    name: "Cambuk lubang hitam", segs: 38, len: 0.70, handle: 0.15, bend: 0.08, damp: 0.996, grav: 700, w0: 7, w1: 2,
    rope: "#140b24", grip: "#2a1f3d", glow: "#b26bff", void: true, threshold: 5100,
    sound: { nDur: 0.002, snap: 0.004, tail: 0.03, tailLevel: 0.3, rate: 0.7, body: [70, 28, 0.4, 1.1], wet: 0.45, echo: [0.3, 0.4, 0.3], extra: "void", gain: 1.2 },
    fx: "warp", word: "VWUUM!", color: "#b26bff", shake: 2,
  },
  fiber: {
    name: "Fiber optik", segs: 36, len: 0.70, handle: 0.12, bend: 0.10, damp: 0.995, grav: 800, w0: 4, w1: 2,
    rope: "#e8f7ff", grip: "#1d2430", fiber: true, threshold: 4800,
    sound: { nDur: 0.0005, snap: 0.0012, tail: 0.01, tailLevel: 0.2, rate: 1.5, body: [200, 90, 0.04, 0.2], wet: 0.4, echo: [0.12, 0.3, 0.2], extra: "arp", gain: 1.3 },
    fx: "rainbow", word: "PEW!", color: "#ff7ad9", shake: 0.7,
  },
  robot: {
    name: "Lengan robot", segs: 9, len: 0.55, handle: 0.12, bend: 0.38, damp: 0.99, grav: 1300, w0: 12, w1: 7,
    rope: "#9aa4ae", grip: "#2c323b", robot: true, threshold: 3800,
    sound: { nDur: 0.0018, snap: 0.003, tail: 0.012, tailLevel: 0.3, rate: 0.8, body: [160, 55, 0.1, 0.9], wet: 0.2, echo: null, extra: "servo", gain: 1.1 },
    fx: "welding", word: "KLANK!", color: "#ffcf5a", shake: 1.6,
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
