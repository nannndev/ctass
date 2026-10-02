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
    const hx = base.x + dir.x * this.handleLen, hy = base.y + dir.y * this.handleLen;
    for (let i = 0; i < this.n; i++) {
      this.x[i] = this.px[i] = hx + i * this.seg * 0.15 * Math.sign(dir.x || 1);
      this.y[i] = this.py[i] = hy + i * this.seg * 0.98;
    }
  }

  // Satu sub-step. (bx,by) = pangkal gagang (tangan), (hx,hy) = ujung gagang.
  // Balikin kecepatan ujung pecut dalam px/s.
  step(dt, bx, by, hx, hy) {
    const { x, y, px, py, n, seg, v } = this;
    const g = v.grav * dt * dt, d = v.damp;
    x[0] = px[0] = hx; y[0] = py[0] = hy;
    for (let i = 1; i < n; i++) {
      const vx = (x[i] - px[i]) * d, vy = (y[i] - py[i]) * d;
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx; y[i] += vy + g;
    }
    const bendRest = seg * 2, rootRest = this.handleLen + seg;
    for (let k = 0; k < 10; k++) {
      // akar: segmen pertama nyambung lurus dari gagang
      pull(x, y, 1, bx, by, rootRest, 0.5);
      for (let i = 0; i < n - 1; i++) link(x, y, i, i + 1, seg, 1, i === 0);
      // kekakuan lentur: titik i & i+2 pengin lurus (cuma dorong, nggak narik)
      for (let i = 0; i < n - 2; i++) link(x, y, i, i + 2, bendRest, v.bend, i === 0, true);
    }
    const t = n - 1;
    return Math.hypot(x[t] - px[t], y[t] - py[t]) / dt;
  }

  tip() { const t = this.n - 1; return { x: this.x[t], y: this.y[t] }; }
}

function pull(x, y, j, ax, ay, rest, s) {
  const dx = x[j] - ax, dy = y[j] - ay;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const diff = ((dist - rest) / dist) * s;
  x[j] -= dx * diff; y[j] -= dy * diff;
}

function link(x, y, a, b, rest, s, aFixed, pushOnly) {
  const dx = x[b] - x[a], dy = y[b] - y[a];
  const dist = Math.hypot(dx, dy) || 1e-6;
  if (pushOnly && dist >= rest) return;
  const diff = ((dist - rest) / dist) * s;
  if (aFixed) { x[b] -= dx * diff; y[b] -= dy * diff; return; }
  x[a] += dx * diff * 0.5; y[a] += dy * diff * 0.5;
  x[b] -= dx * diff * 0.5; y[b] -= dy * diff * 0.5;
}
