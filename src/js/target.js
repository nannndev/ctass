// Samsak: sasaran yang bisa dipecut. Dipakai stage.js (fisika + gambar 2D) dan whip3d.js (model 3D).
//
// Bentuknya tabung yang digantung rantai dari satu titik (jangkar). Fisikanya:
// - bandul: ngayun kiri-kanan (theta) dan maju-mundur (phi, cuma keliatan di 3D)
// - puter: kena samping bikin samsaknya muter di porosnya (psi), rantai narik balik pelan-pelan
// - penyok: permukaan dibagi kotak-kotak (baris tinggi x sudut keliling). Tiap kotak punya penyok
//   permanen + penyok kenyal yang goyang balik. Yang kena dipukul masuk, sisi sebaliknya menggembung.
// - bekas: tiap sabetan ninggalin tanda sesuai jenis pecutnya (gosong, sayatan plasma, lebam, ...)
// - HP: habis = samsaknya pecah, beberapa detik kemudian samsak baru turun
//
// Koordinat lokal samsak: sudut keliling a diukur dari +x (kanan layar) ke arah kamera,
// jadi a = 90° itu muka yang ngadep kita. v = tinggi, 0 = atas, 1 = bawah.

export const ROWS = 12, COLS = 20;
const TAU = Math.PI * 2;
const MAX_DENT = 0.38;   // penyok permanen maksimum (fraksi jari-jari)
const GRAV = 7;          // kekuatan gravitasi bandul (ω² di rad/s²): sekali ayun ~2,4 detik

// jenis bekas tiap pecut, dari flag di variants.js
export function markKind(v) {
  if (v.fire) return "burn";
  if (v.core) return "melt";
  if (v.arcs) return "char";
  if (v.holo) return "glitch";
  if (v.void) return "void";
  if (v.fiber) return "rainbow";
  if (v.chain || v.chrome || v.robot) return "dent";
  if (v.flat) return "welt";
  if (v.strands) return "scratch";
  return "lash";
}

// bentuk samping samsak: tabung yang ujung atas-bawahnya membulat
export function profile(v) {
  const e = Math.abs(2 * v - 1);
  return Math.pow(Math.max(0, 1 - Math.pow(e, 7)), 1 / 7);
}

export class Bag {
  constructor() {
    this.perm = new Float32Array(ROWS * COLS); // penyok permanen
    this.el = new Float32Array(ROWS * COLS);   // penyok kenyal
    this.ev = new Float32Array(ROWS * COLS);   // kecepatan penyok kenyal
    this.marks = [];
    this.anchor = { x: 0, y: 0, vx: 0, vy: 0 };
    this.reset();
    this.ko = 0;          // berapa kali udah dihancurin
    this.version = 0;     // naik tiap tampilan bekas berubah (biar tekstur 3D digambar ulang)
  }

  reset() {
    this.perm.fill(0); this.el.fill(0); this.ev.fill(0);
    this.marks.length = 0;
    this.theta = 0; this.omega = 0;   // ayunan kiri-kanan
    this.phi = 0; this.phiV = 0;      // ayunan maju-mundur (3D)
    this.psi = 0; this.psiV = 0;      // puteran di poros
    this.squash = 0; this.squashV = 0;
    this.hp = 100;
    this.broken = 0;      // > 0: lagi pecah, ngitung mundur sampe samsak baru turun
    this.drop = 1;        // 1 = samsak baru masih di atas, turun ke 0
    this.hpShown = 0;     // berapa lama lagi bar HP keliatan
    this.version = (this.version || 0) + 1;
  }

  // ukuran ngikut sisi layar terpendek
  size(S) {
    this.r = Math.max(14, S * 0.06);       // jari-jari
    this.h = Math.max(60, S * 0.3);        // tinggi badan
    this.chain = Math.max(16, S * 0.09);   // panjang rantai
    this.L = this.chain + this.h * 0.5;    // jangkar ke titik berat
  }

  // pindahin jangkar (lagi diseret / dari pengaturan)
  setAnchor(x, y, dt = 0) {
    const a = this.anchor;
    if (dt > 0) {
      const vx = (x - a.x) / dt, vy = (y - a.y) / dt;
      // percepatan jangkar bikin samsaknya ngayun telat (kayak bandul yang ditenteng)
      const ax = (vx - a.vx) / dt, ay = (vy - a.vy) / dt;
      this.omega -= ((ax * Math.cos(this.theta) - ay * Math.sin(this.theta)) / this.L) * dt * 0.6;
      a.vx = vx; a.vy = vy;
    } else { a.vx = a.vy = 0; }
    a.x = x; a.y = y;
  }

  // titik di layar dari koordinat lokal (lx ke kanan, ly ke bawah, dari jangkar)
  toScreen(lx, ly) {
    const c = Math.cos(this.theta), s = Math.sin(this.theta);
    return [this.anchor.x + lx * c - ly * s, this.anchor.y + lx * s + ly * c];
  }
  toLocal(x, y) {
    const dx = x - this.anchor.x, dy = y - this.anchor.y, c = Math.cos(this.theta), s = Math.sin(this.theta);
    return [dx * c + dy * s, -dx * s + dy * c];
  }
  get top() { return this.chain - this.drop * (this.chain + this.h * 1.4); }

  // penyok di (tinggi v, sudut lokal a): permanen + kenyal, dihalusin antar kotak
  dentAt(v, a) {
    const rf = Math.min(ROWS - 1, Math.max(0, v * (ROWS - 1))), r0 = Math.floor(rf), r1 = Math.min(ROWS - 1, r0 + 1), tr = rf - r0;
    const f = (((a % TAU) + TAU) % TAU) / TAU * COLS, k0 = Math.floor(f) % COLS, k1 = (k0 + 1) % COLS, tk = f - Math.floor(f);
    const d = (i) => this.perm[i] + this.el[i];
    const a0 = d(r0 * COLS + k0) * (1 - tk) + d(r0 * COLS + k1) * tk;
    const a1 = d(r1 * COLS + k0) * (1 - tk) + d(r1 * COLS + k1) * tk;
    return a0 * (1 - tr) + a1 * tr;
  }
  // jari-jari permukaan di (v, sudut lokal)
  radiusLocal(v, a) {
    return this.r * profile(v) * (1 + this.squash * 0.25) * (1 - this.dentAt(v, a));
  }
  // jari-jari permukaan di (v, sudut di layar)
  radius(v, aWorld) { return this.radiusLocal(v, aWorld - this.psi); }

  // apa titik layar ini kena badan samsak? (buat sabetan & buat nyeret)
  contains(x, y, pad = 0) {
    if (this.broken > 0) return false;
    const [lx, ly] = this.toLocal(x, y), v = (ly - this.top) / this.h;
    if (v < -pad / this.h || v > 1 + pad / this.h) return false;
    const rr = this.r * profile(Math.min(1, Math.max(0, v))) + pad;
    return Math.abs(lx) < Math.max(rr, pad);
  }
  // pegangan buat nyeret: badan, rantai, atau kait di atas
  grabbable(x, y) {
    if (this.contains(x, y, 10)) return true;
    const [lx, ly] = this.toLocal(x, y);
    return Math.abs(lx) < 16 && ly > -16 && ly < this.top + 4;
  }

  // Kena sabetan. (x, y) titik kena di layar, (vx, vy) kecepatan ujung pecut, mach = kecepatan / batas ctarr.
  // Balikin damage (0 = nggak dihitung).
  hit(x, y, vx, vy, mach, kind, color) {
    if (this.broken > 0 || this.drop > 0.3) return 0;
    const [lx, ly] = this.toLocal(x, y), v = Math.min(1, Math.max(0, (ly - this.top) / this.h));
    const u = Math.max(-0.98, Math.min(0.98, lx / (this.r * Math.max(0.3, profile(v)))));
    const aWorld = Math.acos(u);            // titik yang keliatan kena (0 = kanan, 90° = depan)
    const aLocal = aWorld - this.psi;
    const c = Math.cos(this.theta), s = Math.sin(this.theta);
    const lvx = vx * c + vy * s, power = Math.min(2.2, mach);
    const heavy = kind === "dent" ? 1.7 : kind === "welt" ? 1.25 : 1;

    // penyok: gaussian di sekitar titik kena, sisi seberang menggembung dikit
    const row = v * (ROWS - 1), col = (((aLocal % TAU) + TAU) % TAU) / TAU * COLS;
    const depth = 0.07 * power * heavy, kick = 2.6 * power * heavy;
    for (let r = 0; r < ROWS; r++) {
      const dr = (r - row) / 1.3, wr = Math.exp(-dr * dr);
      if (wr < 0.02) continue;
      for (let k = 0; k < COLS; k++) {
        let dk = Math.abs(k - col); dk = Math.min(dk, COLS - dk);
        const i = r * COLS + k, w = wr * Math.exp(-((dk / 1.6) ** 2));
        const opp = wr * Math.exp(-(((COLS / 2 - dk) / 2.2) ** 2));
        this.perm[i] = Math.min(MAX_DENT, Math.max(-0.12, this.perm[i] + depth * w - depth * 0.3 * opp));
        this.ev[i] += kick * w - kick * 0.35 * opp;
      }
    }

    // gerak: ayun searah sabetan, muter kalau kenanya miring, kedorong ke belakang kalau kena muka
    const lat = (lvx / (Math.hypot(vx, vy) || 1)) * power; // bagian sabetan yang nyamping
    this.omega += lat * 0.9 * heavy;
    this.psiV -= lat * Math.sin(aWorld) * 0.9;
    this.phiV -= Math.sin(aWorld) * 0.9 * power;
    this.squashV += 5 * power;

    const dmg = Math.round((3 + 9 * Math.max(0, mach - 0.3)) * heavy);
    this.hp = Math.max(0, this.hp - dmg);
    this.hpShown = 2.5;
    this.marks.push({ a: aLocal, v, rot: Math.atan2(vy, vx) - this.theta, kind, color, size: 0.6 + 0.5 * Math.min(1.6, mach), age: 0, seed: Math.random() });
    if (this.marks.length > 60) this.marks.shift();
    this.version++;
    if (this.hp <= 0) { this.broken = 2.4; this.ko++; }
    return dmg;
  }

  step(dt) {
    // samsak baru turun dari atas
    if (this.broken > 0) {
      this.broken -= dt;
      if (this.broken <= 0) { const ko = this.ko; this.reset(); this.ko = ko; }
    } else if (this.drop > 0) this.drop = Math.max(0, this.drop - dt * 1.6);

    // bandul: gravitasi + redaman udara
    this.omega += (-GRAV * Math.sin(this.theta) - this.omega * 0.55) * dt;
    this.theta += this.omega * dt;
    this.theta = Math.max(-1.2, Math.min(1.2, this.theta));
    this.phiV += (-GRAV * Math.sin(this.phi) - this.phiV * 0.8) * dt;
    this.phi = Math.max(-0.6, Math.min(0.6, this.phi + this.phiV * dt));
    // rantai yang kepelintir narik balik puterannya
    this.psiV += (-this.psi * 1.4 - this.psiV * 0.7) * dt;
    this.psi += this.psiV * dt;
    this.squashV += (-this.squash * 260 - this.squashV * 14) * dt;
    this.squash += this.squashV * dt;
    // penyok kenyal: pegas cepet
    const { el, ev } = this, n = el.length, k = 900, c = 26;
    for (let i = 0; i < n; i++) {
      ev[i] += (-el[i] * k - ev[i] * c) * dt;
      el[i] += ev[i] * dt;
    }
    for (const m of this.marks) m.age += dt;
    this.hpShown = Math.max(0, this.hpShown - dt);
  }
}

// angka acak yang sama tiap kali buat satu bekas (biar bentuknya nggak kedip-kedip)
function rng(seed) {
  let t = Math.floor(seed * 4294967296) >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

// Gambar satu bekas di (0, 0) dengan ukuran satuan u px. Konteks udah diputer ke arah sabetan.
// Dipakai buat gambar 2D dan buat ngecat tekstur samsak 3D.
export function paintMark(g, m, u) {
  const R = rng(m.seed), L = u * 1.4 * m.size, hot = Math.max(0, 1 - m.age / 1.4);
  g.save(); g.lineCap = "round";
  switch (m.kind) {
    case "burn": {
      const r = u * 0.55 * m.size, gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, "rgba(12,8,6,0.95)"); gr.addColorStop(0.55, "rgba(40,22,12,0.7)"); gr.addColorStop(1, "rgba(60,30,15,0)");
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * 1.5, r, 0, 0, Math.PI * 2); g.fill();
      if (hot > 0) {
        const gg = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.7);
        gg.addColorStop(0, `rgba(255,190,90,${hot})`); gg.addColorStop(1, "rgba(255,90,20,0)");
        g.fillStyle = gg; g.beginPath(); g.arc(0, 0, r * 0.7, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case "melt": {
      g.strokeStyle = "rgba(30,14,8,0.85)"; g.lineWidth = u * 0.22;
      g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
      if (hot > 0) {
        g.shadowColor = m.color || "#7ff"; g.shadowBlur = u * 0.6;
        g.strokeStyle = `rgba(255,255,255,${hot})`; g.lineWidth = u * 0.1;
        g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
      }
      break;
    }
    case "char": {
      g.strokeStyle = "rgba(15,12,10,0.8)"; g.lineWidth = u * 0.07;
      for (let b = 0; b < 3; b++) {
        let x = 0, y = 0, a = R() * Math.PI * 2;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { a += (R() - 0.5) * 1.6; x += Math.cos(a) * L * 0.18; y += Math.sin(a) * L * 0.18; g.lineTo(x, y); }
        g.stroke();
      }
      if (hot > 0) { g.fillStyle = `rgba(190,220,255,${hot * 0.8})`; g.beginPath(); g.arc(0, 0, u * 0.18, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case "glitch": {
      for (let k = 0; k < 7; k++) {
        g.fillStyle = k % 2 ? "rgba(255,79,216,0.75)" : "rgba(77,227,255,0.75)";
        g.fillRect((R() - 0.5) * L, (R() - 0.5) * u * 0.6, u * (0.1 + R() * 0.25), u * (0.08 + R() * 0.12));
      }
      break;
    }
    case "void": {
      g.fillStyle = "rgba(0,0,0,0.9)"; g.beginPath(); g.arc(0, 0, u * 0.22 * m.size, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(170,90,255,0.7)"; g.lineWidth = u * 0.06; g.beginPath(); g.arc(0, 0, u * 0.32 * m.size, 0, Math.PI * 2); g.stroke();
      break;
    }
    case "rainbow": {
      const gr = g.createLinearGradient(-L / 2, 0, L / 2, 0);
      ["#ff4d6d", "#ffd23f", "#4dff88", "#4de3ff", "#b44dff"].forEach((c, k) => gr.addColorStop(k / 4, c));
      g.globalAlpha = 0.45 + hot * 0.5; g.strokeStyle = gr; g.lineWidth = u * 0.1;
      g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
      break;
    }
    case "dent": {
      const gr = g.createRadialGradient(0, -u * 0.08, 0, 0, 0, u * 0.5 * m.size);
      gr.addColorStop(0, "rgba(0,0,0,0.45)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, u * 0.6 * m.size, u * 0.45 * m.size, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = u * 0.05;
      g.beginPath(); g.arc(0, u * 0.05, u * 0.42 * m.size, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      break;
    }
    case "welt": {
      g.strokeStyle = `rgba(255,${90 + hot * 60},${90 + hot * 40},0.55)`; g.lineWidth = u * 0.32;
      g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
      break;
    }
    case "scratch": {
      g.strokeStyle = "rgba(235,215,190,0.6)"; g.lineWidth = u * 0.04;
      for (let k = -2; k <= 2; k++) {
        const o = k * u * 0.09 + (R() - 0.5) * u * 0.04, l = L * (0.6 + R() * 0.4);
        g.beginPath(); g.moveTo(-l / 2, o); g.lineTo(l / 2, o + (R() - 0.5) * u * 0.1); g.stroke();
      }
      break;
    }
    default: { // lash: goresan tipis, pinggirnya agak gelap
      g.strokeStyle = "rgba(20,10,8,0.45)"; g.lineWidth = u * 0.12;
      g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, (R() - 0.5) * u * 0.3, L / 2, 0); g.stroke();
      g.strokeStyle = "rgba(245,225,200,0.75)"; g.lineWidth = u * 0.05;
      g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, (R() - 0.5) * u * 0.3, L / 2, 0); g.stroke();
    }
  }
  g.restore();
}

// warna samsak per tema
export const BAG_COLORS = {
  classic: { body: "#8a2a21", hi: "#c4553f", band: "#1d1918", stitch: "rgba(240,220,190,0.5)", logo: "rgba(240,225,200,0.85)", chain: "#a9a39a" },
  future: { body: "#18304a", hi: "#2f6b8f", band: "#0a0f16", stitch: "rgba(77,227,255,0.6)", logo: "rgba(120,240,255,0.9)", chain: "#7d8fa3" },
};
