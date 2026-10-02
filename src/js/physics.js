// Tali pecut pakai integrasi Verlet + constraint jarak & lentur.
// Titik 0 = ujung gagang (kinematik, ikut tangan). Titik terakhir = ujung pecut (cracker).
export class Whip {
  constructor(variant, scale, base, dir) {
    this.v = variant;
    this.n = variant.segs + 1;
    this.seg = (variant.len * scale) / variant.segs;
    this.handleLen = variant.handle * scale;
    this.x = new Float32Array(this.n);
    this.y = new Float32Array(this.n);
    this.px = new Float32Array(this.n);
    this.py = new Float32Array(this.n);
    // z = kedalaman (cuma kepake di tampilan 3D; di 2D tetap 0 semua)
    this.z = new Float32Array(this.n);
    this.pz = new Float32Array(this.n);
    this.k = 1;    // faktor panjang tali (< 1 = sebagian lagi digulung)
    this.wind = 0; // angin sepoi-sepoi pas diem (px/s², ke samping)
    this.windZ = 0; // angin ke arah depan/belakang (3D)
    const hx = base.x + dir.x * this.handleLen, hy = base.y + dir.y * this.handleLen;
    for (let i = 0; i < this.n; i++) {
      this.x[i] = this.px[i] = hx + i * this.seg * 0.15 * Math.sign(dir.x || 1);
      this.y[i] = this.py[i] = hy + i * this.seg * 0.98;
    }
  }

  // Satu sub-step. (bx,by,bz) = pangkal gagang (tangan), (hx,hy,hz) = ujung gagang.
  // Balikin kecepatan ujung pecut dalam px/s.
  step(dt, bx, by, hx, hy, bz = 0, hz = 0) {
    const { x, y, z, px, py, pz, n, v } = this, seg = this.seg * this.k;
    const g = v.grav * dt * dt, d = v.damp, w = this.wind * dt * dt, wz = this.windZ * dt * dt;
    x[0] = px[0] = hx; y[0] = py[0] = hy; z[0] = pz[0] = hz;
    for (let i = 1; i < n; i++) {
      const vx = (x[i] - px[i]) * d, vy = (y[i] - py[i]) * d, vz = (z[i] - pz[i]) * d;
      px[i] = x[i]; py[i] = y[i]; pz[i] = z[i];
      x[i] += vx + w * (i / n); y[i] += vy + g; z[i] += vz + wz * (i / n);
    }
    const bendRest = seg * 2, rootRest = this.handleLen + seg;
    for (let k = 0; k < 10; k++) {
      // akar: segmen pertama nyambung lurus dari gagang
      pull(x, y, z, 1, bx, by, bz, rootRest, 0.5);
      for (let i = 0; i < n - 1; i++) link(x, y, z, i, i + 1, seg, 1, i === 0);
      // kekakuan lentur: titik i & i+2 pengin lurus (cuma dorong, nggak narik)
      for (let i = 0; i < n - 2; i++) link(x, y, z, i, i + 2, bendRest, v.bend, i === 0, true);
    }
    const t = n - 1;
    return Math.hypot(x[t] - px[t], y[t] - py[t], z[t] - pz[t]) / dt;
  }

  tip() { const t = this.n - 1; return { x: this.x[t], y: this.y[t] }; }
}

function pull(x, y, z, j, ax, ay, az, rest, s) {
  const dx = x[j] - ax, dy = y[j] - ay, dz = z[j] - az;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
  const diff = ((dist - rest) / dist) * s;
  x[j] -= dx * diff; y[j] -= dy * diff; z[j] -= dz * diff;
}

function link(x, y, z, a, b, rest, s, aFixed, pushOnly) {
  const dx = x[b] - x[a], dy = y[b] - y[a], dz = z[b] - z[a];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
  if (pushOnly && dist >= rest) return;
  const diff = ((dist - rest) / dist) * s;
  if (aFixed) { x[b] -= dx * diff; y[b] -= dy * diff; z[b] -= dz * diff; return; }
  x[a] += dx * diff * 0.5; y[a] += dy * diff * 0.5; z[a] += dz * diff * 0.5;
  x[b] -= dx * diff * 0.5; y[b] -= dy * diff * 0.5; z[b] -= dz * diff * 0.5;
}
