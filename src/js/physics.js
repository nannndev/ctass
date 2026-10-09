// Tali pecut pakai integrasi Verlet + constraint jarak & lentur.
// Titik 0 = ujung gagang, titik terakhir = ujung pecut (cracker).
//
// Gagang bisa lentur (v.flex, 0 = kaku): ujungnya punya inersia sendiri, ditarik pegas balik ke
// posisi lurusnya, dan ikut ketarik tali. Jadi pas disentak gagangnya ngepir dulu baru ngelecut,
// kayak rotan. Bentuk lengkungnya = kurva Bezier dari tangan, titik kontrolnya (cx, cy, cz)
// ada di arah gagang lurus.
//
// Tali makin ke ujung makin ringan (kayak pecut asli yang meruncing). Gelombang yang jalan dari
// gagang jadi makin cepet pas nyampe ujung, ini yang bikin lecutannya ngegulung terus meledak.
const TAPER = 0.6;     // ujung tali beratnya 1 - TAPER dari pangkalnya
const MAX_BEND = 0.5;  // sudut tali busur gagang dari arah lurus, maksimum (radian)

export class Whip {
  constructor(variant, scale, base, dir) {
    this.v = variant;
    this.n = variant.segs + 1;
    this.seg = (variant.len * scale) / variant.segs;
    this.handleLen = variant.handle * scale;
    this.flex = Math.min(1, Math.max(0, variant.flex ?? 0));
    this.x = new Float32Array(this.n);
    this.y = new Float32Array(this.n);
    this.px = new Float32Array(this.n);
    this.py = new Float32Array(this.n);
    // z = kedalaman (cuma kepake di tampilan 3D; di 2D tetap 0 semua)
    this.z = new Float32Array(this.n);
    this.pz = new Float32Array(this.n);
    // kebalikan massa: 0 = nggak bisa digeser constraint (ujung gagang kaku)
    this.im = new Float32Array(this.n);
    for (let i = 1; i < this.n; i++) this.im[i] = 1 / (1 - TAPER * (i / (this.n - 1)));
    // ujung gagang lentur lebih berat dari tali, jadi cuma ketarik dikit
    this.im[0] = this.flex * 0.3;
    this.k = 1;    // faktor panjang tali (< 1 = sebagian lagi digulung)
    this.wind = 0; // angin sepoi-sepoi pas diem (px/s², ke samping)
    this.windZ = 0; // angin ke arah depan/belakang (3D)
    this.attract = null; // { x, y, k }: ujung tali ditarik ke titik ini (mode klik, biar sabetannya kena)
    const hx = base.x + dir.x * this.handleLen, hy = base.y + dir.y * this.handleLen;
    this.cx = (base.x + hx) / 2; this.cy = (base.y + hy) / 2; this.cz = 0;
    for (let i = 0; i < this.n; i++) {
      this.x[i] = this.px[i] = hx + i * this.seg * 0.15 * Math.sign(dir.x || 1);
      this.y[i] = this.py[i] = hy + i * this.seg * 0.98;
    }
  }

  // Satu sub-step. (bx,by,bz) = pangkal gagang (tangan), (hx,hy,hz) = ujung gagang kalau lurus.
  // Balikin kecepatan ujung pecut dalam px/s.
  step(dt, bx, by, hx, hy, bz = 0, hz = 0) {
    const { x, y, z, px, py, pz, n, v, im } = this, seg = this.seg * this.k;
    const g = v.grav * dt * dt, d = v.damp, w = this.wind * dt * dt, wz = this.windZ * dt * dt;
    const L = this.handleLen, fl = this.flex;
    // arah gagang lurus (dari tangan)
    let rx = hx - bx, ry = hy - by, rz = hz - bz;
    const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;

    if (fl > 0) {
      // ujung gagang: inersia + pegas balik ke posisi lurus. Makin lentur, pegasnya makin lembek.
      const dh = 0.988, ks = 0.014 + (1 - fl) ** 2 * 0.25;
      const vx = (x[0] - px[0]) * dh, vy = (y[0] - py[0]) * dh, vz = (z[0] - pz[0]) * dh;
      px[0] = x[0]; py[0] = y[0]; pz[0] = z[0];
      x[0] += vx + (hx - x[0] - vx) * ks;
      y[0] += vy + (hy - y[0] - vy) * ks + g * 0.15;
      z[0] += vz + (hz - z[0] - vz) * ks;
      this.bendHandle(bx, by, bz, rx, ry, rz);
    } else {
      x[0] = px[0] = hx; y[0] = py[0] = hy; z[0] = pz[0] = hz;
      this.cx = (bx + hx) / 2; this.cy = (by + hy) / 2; this.cz = (bz + hz) / 2;
    }

    for (let i = 1; i < n; i++) {
      const vx = (x[i] - px[i]) * d, vy = (y[i] - py[i]) * d, vz = (z[i] - pz[i]) * d;
      px[i] = x[i]; py[i] = y[i]; pz[i] = z[i];
      x[i] += vx + w * (i / n); y[i] += vy + g; z[i] += vz + wz * (i / n);
    }
    const bendRest = seg * 2, rootRest = L + seg;
    for (let k = 0; k < 10; k++) {
      // akar: segmen pertama nyambung searah ujung gagang (garis singgung kurva gagang)
      let tx = x[0] - this.cx, ty = y[0] - this.cy, tz = z[0] - this.cz;
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      pull(x, y, z, 1, x[0] - tx * L, y[0] - ty * L, z[0] - tz * L, rootRest, 0.5);
      for (let i = 0; i < n - 1; i++) link(x, y, z, im, i, i + 1, seg, 1);
      // kekakuan lentur: titik i & i+2 pengin lurus (cuma dorong, nggak narik)
      for (let i = 0; i < n - 2; i++) link(x, y, z, im, i, i + 2, bendRest, v.bend, true);
      if (fl > 0) this.bendHandle(bx, by, bz, rx, ry, rz);
    }
    const at = this.attract;
    if (at) {
      // makin ke ujung makin kuat; pangkal tali tetap ngikut gagang
      for (let i = (n * 0.45) | 0; i < n; i++) {
        const f = (i / (n - 1)) ** 3 * at.k;
        x[i] += (at.x - x[i]) * f; y[i] += (at.y - y[i]) * f; z[i] -= z[i] * f;
      }
    }
    const t = n - 1;
    return Math.hypot(x[t] - px[t], y[t] - py[t], z[t] - pz[t]) / dt;
  }

  // Jaga ujung gagang lentur tetap masuk akal: lengkungnya dibatasi, dan panjang gagang (sepanjang
  // kurva) tetap. Busur sepanjang L yang tali busurnya miring θ dari arah awal: tali busur = L·sin θ / θ.
  bendHandle(bx, by, bz, rx, ry, rz) {
    const { x, y, z } = this, L = this.handleLen;
    let ux = x[0] - bx, uy = y[0] - by, uz = z[0] - bz;
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const c = ux * rx + uy * ry + uz * rz;
    let th = Math.acos(Math.min(1, Math.max(-1, c)));
    if (th > MAX_BEND) {
      // puter balik ke batas lengkung, di bidang yang sama
      let ox = ux - rx * c, oy = uy - ry * c, oz = uz - rz * c;
      const ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;
      const cs = Math.cos(MAX_BEND), sn = Math.sin(MAX_BEND);
      ux = rx * cs + ox * sn; uy = ry * cs + oy * sn; uz = rz * cs + oz * sn;
      th = MAX_BEND;
    }
    const chord = th > 1e-4 ? (L * Math.sin(th)) / th : L;
    x[0] = bx + ux * chord; y[0] = by + uy * chord; z[0] = bz + uz * chord;
    // titik kontrol Bezier = perpotongan garis singgung pangkal & ujung busur
    const h = (chord * 0.5) / Math.cos(th);
    this.cx = bx + rx * h; this.cy = by + ry * h; this.cz = bz + rz * h;
  }

  tip() { const t = this.n - 1; return { x: this.x[t], y: this.y[t] }; }
}

function pull(x, y, z, j, ax, ay, az, rest, s) {
  const dx = x[j] - ax, dy = y[j] - ay, dz = z[j] - az;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
  const diff = ((dist - rest) / dist) * s;
  x[j] -= dx * diff; y[j] -= dy * diff; z[j] -= dz * diff;
}

// constraint jarak a–b, koreksinya dibagi sesuai kebalikan massa (yang ringan geser lebih jauh)
function link(x, y, z, im, a, b, rest, s, pushOnly) {
  const wa = im[a], wb = im[b], ws = wa + wb;
  if (!ws) return;
  const dx = x[b] - x[a], dy = y[b] - y[a], dz = z[b] - z[a];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
  if (pushOnly && dist >= rest) return;
  const diff = ((dist - rest) / dist) * s, fa = (diff * wa) / ws, fb = (diff * wb) / ws;
  x[a] += dx * fa; y[a] += dy * fa; z[a] += dz * fa;
  x[b] -= dx * fb; y[b] -= dy * fb; z[b] -= dz * fb;
}
