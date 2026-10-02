// Panggung pecut: fisika + gambar + deteksi ctarr. Dipakai app desktop dan demo di landing page.
import { VARIANTS, AI_LINES } from "./variants.js";
import { Whip } from "./physics.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {import("./audio.js").Sound} o.sound
 * @param {boolean} [o.transparent]  gambar tanpa latar (overlay desktop)
 * @param {number}  [o.aiScale]      ukuran robot relatif sisi terpendek
 * @param {boolean} [o.showAI]       tampilkan robot sasaran (default false)
 * @param {number}  [o.size]         skala panjang pecut (default 1)
 * @param {(s:{crack:number,hit:number,best:number}) => void} [o.onScore]
 * @param {(mach:number, shown:number) => void} [o.onMach]
 * @param {(text:string, x:number, y:number) => void} [o.onSay]  x,y relatif ke kanvas
 * @param {() => void} [o.onFirstMove]
 */
export function createStage(o) {
  const cv = o.canvas, cx = cv.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const FONT_DISPLAY = css.getPropertyValue("--display") || "sans-serif";
  const FONT_MONO = css.getPropertyValue("--mono") || "monospace";
  // warna panggung ngikut tema halaman (fallback = tema default)
  const tok = (name, fb) => css.getPropertyValue(name).trim() || fb;
  const C = {
    stage1: tok("--stage-1", "#1a1a1d"), stage2: tok("--stage-2", "#0b0b0c"), floor: tok("--stage-line", "rgba(236,232,225,0.06)"),
    robot: tok("--robot", "#1d1d21"), robotLine: tok("--robot-line", "#8c877e"), screen: tok("--robot-screen", "#0b0b0c"),
    eye: tok("--robot-eye", "#e9dcc0"), accent: tok("--accent", "#d4b98c"), ember: tok("--ember", "#e2775a"),
    ring: tok("--ring", "236,232,225"),
  };

  let W = 0, H = 0, S = 0;
  let key = "jaranan", v = VARIANTS[key], whip;
  const ptr = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, seen: false };
  const dir = { x: 0.4, y: -0.92 };
  let side = 1; // -1 = terakhir ngayun ke kiri, 1 = ke kanan
  let prevAbove = false, crackCool = 0, hitCool = 0, shake = 0, machShown = 0;
  const fx = [];
  const ai = { x: 0, y: 0, w: 0, h: 0, wobble: 0, mood: 0 };
  const score = { crack: 0, hit: 0, best: 0 };
  const session = { crack: 0, hit: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height; S = Math.min(W, H);
    cv.width = W * dpr; cv.height = H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ai.w = Math.max(72, S * (o.aiScale ?? 0.17)); ai.h = ai.w * 0.86;
    ai.x = W > 700 ? W * 0.8 : W * 0.74; ai.y = H * 0.48;
    if (!ptr.seen) { ptr.x = ptr.px = W * 0.3; ptr.y = ptr.py = H * 0.62; }
    build();
  }
  const showAI = o.showAI ?? false;
  function build() { whip = new Whip(v, S * (o.size ?? 1), ptr, dir); }

  function move(e) {
    const r = cv.getBoundingClientRect();
    ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
    if (!ptr.seen) { ptr.seen = true; o.onFirstMove?.(); }
  }
  cv.addEventListener("pointermove", move);
  cv.addEventListener("pointerdown", (e) => { o.sound.init(); move(e); cv.setPointerCapture?.(e.pointerId); });

  function pick(k) { if (!VARIANTS[k]) return; key = k; v = VARIANTS[k]; build(); warm(); }
  // pakai pecut yang udah dicustom (lihat settings.js)
  function use(variant, k = key) { key = k; v = variant; build(); warm(); }
  function warm() { o.sound.pending = v.sound; o.sound.prepare?.(v.sound); }

  function onCrack(mach) {
    const t = whip.tip();
    score.crack++; session.crack++; score.best = Math.max(score.best, mach); o.onScore?.(score);
    o.sound.crack(mach - 1, v.sound, (t.x / W) * 2 - 1);
    shake = reduced ? 0 : (6 + Math.min(10, (mach - 1) * 8)) * (v.shake ?? 1);
    const big = mach > 1.4;
    fx.push({ k: "text", x: t.x, y: t.y - 12, life: 1, rate: 1.4, s: big && v.word.endsWith("!") ? v.word + "!" : v.word, color: v.color, size: v.fx === "star" ? 0.75 : v.fx === "dust" ? 1.25 : 1 });
    if (reduced) { fx.push({ k: "ring", x: t.x, y: t.y, r: 4, speed: 400, width: 1.5, color: C.ring, life: 1, rate: 2.2 }); return; }
    burst(v.fx, t, mach);
  }

  // efek visual khas tiap pecut
  function burst(kind, t, mach) {
    const n = whip.n - 1, dx = whip.x[n] - whip.x[n - 1], dy = whip.y[n] - whip.y[n - 1];
    const heading = Math.atan2(dy, dx), rnd = (a, b) => a + Math.random() * (b - a);
    const add = (p) => fx.push(Object.assign({ x: t.x, y: t.y, life: 1, rate: 2.2 }, p));
    switch (kind) {
      case "confetti": // serpihan rumbai merah-kuning-hijau
        add({ k: "ring", r: 4, speed: 480, width: 1.5, color: C.ring });
        for (let i = 0; i < 22; i++) {
          const a = rnd(0, Math.PI * 2), sp = rnd(120, 420);
          add({ k: "bit", vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, rot: rnd(0, 6), vr: rnd(-14, 14), w: rnd(3, 6), h: rnd(6, 11),
            color: ["#d63a2a", "#f2c23a", "#2f8f4e"][i % 3], rate: rnd(0.8, 1.2) });
        }
        break;
      case "dust": // kepulan debu cambuk sapi
        add({ k: "ring", r: 6, speed: 300, width: 3, color: "201,162,122", rate: 2.6 });
        for (let i = 0; i < 14; i++) {
          const a = rnd(0, Math.PI * 2), sp = rnd(30, 140);
          add({ k: "dust", vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, r: rnd(6, 14), grow: rnd(30, 70), rate: rnd(0.9, 1.4) });
        }
        break;
      case "shock": // gelombang kejut dobel + garis kecepatan bullwhip
        add({ k: "ring", r: 2, speed: 900, width: 2, color: C.ring, rate: 3 });
        add({ k: "ring", r: 2, speed: 560, width: 1, color: C.ring, rate: 2.4 });
        for (let i = 0; i < 9; i++) {
          const a = heading + rnd(-0.5, 0.5);
          add({ k: "line", a, d: rnd(6, 20), len: rnd(30, 90) * Math.min(1.6, mach), speed: rnd(500, 900), rate: rnd(3, 4.5) });
        }
        break;
      case "magic": // kilatan emas + percikan Samandiman
        add({ k: "flash", r: 70 + mach * 40, rate: 3.2 });
        add({ k: "ring", r: 4, speed: 360, width: 2, color: "244,201,93", rate: 1.6 });
        for (let i = 0; i < 26; i++) {
          const a = rnd(0, Math.PI * 2), sp = rnd(120, 460);
          add({ k: "spark", vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rnd(2, 4), rate: rnd(1.2, 2) });
        }
        break;
      case "star": // bintang kecil tajam cemeti
        add({ k: "star", spikes: 8, len: 18 + mach * 8, rot: rnd(0, 1), rate: 3.6 });
        break;
      case "sticks": // patahan lidi beterbangan
        for (let i = 0; i < 12; i++) {
          const a = heading + rnd(-1.4, 1.4), sp = rnd(160, 420);
          add({ k: "stick", vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, rot: rnd(0, 6), vr: rnd(-18, 18), len: rnd(8, 18), rate: rnd(0.9, 1.4) });
        }
        add({ k: "ring", r: 4, speed: 300, width: 1, color: "200,169,106", rate: 2.6 });
        break;
      case "zap": // kilatan listrik kabel charger
        add({ k: "flash", r: 40 + mach * 20, rate: 5, tint: "124,199,255" });
        for (let i = 0; i < 5; i++) add({ k: "bolt", a: rnd(0, Math.PI * 2), len: rnd(35, 80) * Math.min(1.5, mach), rate: rnd(4, 6) });
        break;
      case "impact": // ledakan ala komik
        add({ k: "burst", r: 16, grow: 160, spikes: 12, rot: rnd(0, 1), rate: 3.2 });
        break;
      case "fire": // semburan bara
        add({ k: "flash", r: 60 + mach * 30, rate: 3.5, tint: "255,122,46" });
        for (let i = 0; i < 24; i++) {
          const a = rnd(0, Math.PI * 2), sp = rnd(60, 280);
          add({ k: "ember", vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, size: rnd(2, 5), rate: rnd(1.2, 2.2) });
        }
        break;
    }
  }
  function onHit(cracked) {
    score.hit++; session.hit++; o.onScore?.(score);
    ai.wobble = 1; ai.mood = 1; o.sound.thud((ai.x / W) * 2 - 1);
    o.onSay?.(AI_LINES[Math.floor(Math.random() * AI_LINES.length)], ai.x, ai.y - ai.h * 0.62);
    if (!cracked) fx.push({ k: "text", x: ai.x, y: ai.y - ai.h / 2, life: 1, rate: 1.4, s: "PLAK!", color: C.ember, size: 1 });
  }
  function tipInAI() {
    for (let i = whip.n - 4; i < whip.n; i++) {
      if (Math.abs(whip.x[i] - ai.x) < ai.w / 2 + 6 && Math.abs(whip.y[i] - ai.y) < ai.h / 2 + 6) return true;
    }
    return false;
  }

  let last = performance.now(), running = true;
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now;

    // arah gagang ikut arah ayunan tangan. Kalau diam, gagang tegak dan miring dikit
    // ke sisi terakhir lu ngayun (kiri atau kanan), jadi bisa nyabet ke dua arah.
    ptr.vx += ((ptr.x - ptr.px) / dt - ptr.vx) * 0.35;
    ptr.vy += ((ptr.y - ptr.py) / dt - ptr.vy) * 0.35;
    if (Math.abs(ptr.vx) > 250) side += (Math.sign(ptr.vx) - side) * 0.2;
    const rx = 0.4 * side, ry = -Math.sqrt(1 - rx * rx);
    let tx = rx * 260 + ptr.vx * 0.6, ty = ry * 260 + ptr.vy * 0.6;
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const ox = dir.x, oy = dir.y;
    dir.x += (tx - dir.x) * 0.3; dir.y += (ty - dir.y) * 0.3;
    const dl = Math.hypot(dir.x, dir.y) || 1; dir.x /= dl; dir.y /= dl;

    const sub = Math.max(2, Math.ceil(dt * 240)), h = dt / sub;
    let tip = 0;
    for (let s = 1; s <= sub; s++) {
      const f = s / sub;
      const bx = ptr.px + (ptr.x - ptr.px) * f, by = ptr.py + (ptr.y - ptr.py) * f;
      const ddx = ox + (dir.x - ox) * f, ddy = oy + (dir.y - oy) * f;
      tip = Math.max(tip, whip.step(h, bx, by, bx + ddx * whip.handleLen, by + ddy * whip.handleLen));
    }
    ptr.px = ptr.x; ptr.py = ptr.y;

    const mach = tip / v.threshold;
    machShown = Math.max(mach, machShown * 0.9);
    crackCool -= dt; hitCool -= dt;
    const above = mach >= 1;
    let cracked = false;
    if (above && !prevAbove && crackCool <= 0) { onCrack(mach); crackCool = 0.28; cracked = true; }
    prevAbove = above;
    if (showAI && mach > 0.45 && hitCool <= 0 && tipInAI()) { onHit(cracked); hitCool = 0.6; }

    o.onMach?.(mach, machShown);
    draw(dt);
    if (running) requestAnimationFrame(frame);
  }

  // ---------- Gambar ----------
  function draw(dt) {
    cx.save();
    if (o.transparent) {
      cx.clearRect(0, 0, W, H);
    } else {
      const gr = cx.createRadialGradient(W * 0.5, H * 0.55, S * 0.1, W * 0.5, H * 0.55, Math.max(W, H) * 0.8);
      gr.addColorStop(0, C.stage1); gr.addColorStop(1, C.stage2);
      cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
      cx.strokeStyle = C.floor; cx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const y = H * 0.78 + i * i * 6; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
    }
    if (shake > 0) {
      cx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.82; if (shake < 0.3) shake = 0;
    }
    if (showAI) drawAI(dt);
    drawHandle();
    drawRope();
    drawFx(dt);
    cx.restore();
    if (o.cursorDot ?? true) {
      cx.fillStyle = "rgba(243,231,211,0.9)";
      cx.beginPath(); cx.arc(ptr.x, ptr.y, 4, 0, Math.PI * 2); cx.fill();
    }
  }

  function drawHandle() {
    const hx = whip.x[0], hy = whip.y[0];
    cx.lineCap = "round";
    cx.strokeStyle = v.grip; cx.lineWidth = Math.max(8, S * 0.018);
    cx.beginPath(); cx.moveTo(ptr.x, ptr.y); cx.lineTo(hx, hy); cx.stroke();
    // lilitan kulit
    const L = Math.hypot(hx - ptr.x, hy - ptr.y) || 1, nx = -(hy - ptr.y) / L, ny = (hx - ptr.x) / L, hw = Math.max(4, S * 0.009);
    cx.strokeStyle = "rgba(0,0,0,0.35)"; cx.lineWidth = 2;
    for (let i = 1; i < 10; i++) {
      const f = i / 10, px = ptr.x + (hx - ptr.x) * f, py = ptr.y + (hy - ptr.y) * f;
      cx.beginPath(); cx.moveTo(px + nx * hw, py + ny * hw);
      cx.lineTo(px - nx * hw + (hx - ptr.x) * 0.03, py - ny * hw + (hy - ptr.y) * 0.03); cx.stroke();
    }
    if (v.tassel && !v.glow) { // rumbai jaranan
      ["#d63a2a", "#f2c23a", "#2f8f4e", "#d63a2a"].forEach((c, i) => {
        const a = Math.atan2(dir.y, dir.x) + Math.PI + (i - 1.5) * 0.35 + Math.sin(performance.now() / 300 + i) * 0.1;
        cx.strokeStyle = c; cx.lineWidth = 3;
        cx.beginPath(); cx.moveTo(ptr.x, ptr.y);
        cx.quadraticCurveTo(ptr.x + Math.cos(a) * 18, ptr.y + Math.sin(a) * 18 + 6, ptr.x + Math.cos(a) * 26, ptr.y + Math.sin(a) * 26 + 22);
        cx.stroke();
      });
    }
  }

  function drawRope() {
    const { x, y, n } = whip;
    if (v.strands) return drawStrands();
    if (v.glow) {
      cx.shadowColor = typeof v.glow === "string" ? v.glow : "#ffd36b";
      cx.shadowBlur = 14 + Math.min(30, machShown * 18);
    }
    cx.strokeStyle = v.rope;
    cx.lineCap = v.flat ? "butt" : "round";
    for (let i = 0; i < n - 1; i++) {
      cx.lineWidth = v.w0 + (v.w1 - v.w0) * Math.pow(i / (n - 1), 0.7);
      cx.beginPath(); cx.moveTo(x[i], y[i]); cx.lineTo(x[i + 1], y[i + 1]); cx.stroke();
    }
    cx.lineCap = "round";
    cx.shadowBlur = 0;
    if (v.flat) {
      // jahitan tengah sabuk
      cx.strokeStyle = "rgba(236,232,225,0.35)"; cx.lineWidth = 1; cx.setLineDash([3, 4]);
      cx.beginPath(); cx.moveTo(x[0], y[0]);
      for (let i = 1; i < n; i++) cx.lineTo(x[i], y[i]);
      cx.stroke(); cx.setLineDash([]);
    } else if (!v.plug) {
      // anyaman
      cx.strokeStyle = "rgba(0,0,0,0.28)"; cx.lineWidth = 1;
      for (let i = 1; i < n - 3; i += 2) {
        const dx = x[i + 1] - x[i], dy = y[i + 1] - y[i], l = Math.hypot(dx, dy) || 1;
        const w = (v.w0 + (v.w1 - v.w0) * (i / (n - 1))) * 0.5;
        cx.beginPath(); cx.moveTo(x[i] - (dy / l) * w, y[i] + (dx / l) * w);
        cx.lineTo(x[i] + (dy / l) * w + dx * 0.4, y[i] - (dx / l) * w + dy * 0.4); cx.stroke();
      }
    }
    const t = n - 1, dx = x[t] - x[t - 1], dy = y[t] - y[t - 1], l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l;
    if (v.plug) return drawTip(x[t], y[t], ux, uy, "plug");
    if (v.buckle) return drawTip(x[t], y[t], ux, uy, "buckle");
    // cracker di ujung
    cx.strokeStyle = v.glow ? "#fff3c4" : "#efe6d6"; cx.lineWidth = 1.2;
    for (let k = -1; k <= 1; k++) {
      cx.beginPath(); cx.moveTo(x[t], y[t]);
      cx.lineTo(x[t] + ux * 14 + -uy * k * 3, y[t] + uy * 14 + ux * k * 3 + 3);
      cx.stroke();
    }
    if (v.fire && !reduced && machShown > 0.35 && Math.random() < 0.7) {
      fx.push({ k: "ember", x: x[t], y: y[t], vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, size: 1.5 + Math.random() * 2.5, life: 1, rate: 2.5 });
    }
  }

  // sapu lidi: beberapa lidi yang makin ke ujung makin mekar
  function drawStrands() {
    const { x, y, n } = whip, m = v.strands, spread = v.spread * S * v.len;
    cx.strokeStyle = v.rope; cx.lineWidth = v.w0;
    for (let k = 0; k < m; k++) {
      const side = (k - (m - 1) / 2) / ((m - 1) / 2);
      cx.beginPath();
      for (let i = 0; i < n; i++) {
        const j = Math.min(n - 1, Math.max(1, i)), dx = x[j] - x[j - 1], dy = y[j] - y[j - 1], l = Math.hypot(dx, dy) || 1;
        const f = i / (n - 1), off = side * spread * f * f + side * 2;
        const px = x[i] - (dy / l) * off, py = y[i] + (dx / l) * off;
        i ? cx.lineTo(px, py) : cx.moveTo(px, py);
      }
      cx.lineWidth = k % 2 ? v.w1 + 0.4 : v.w0;
      cx.stroke();
    }
  }

  function drawTip(px, py, ux, uy, kind) {
    cx.save(); cx.translate(px, py); cx.rotate(Math.atan2(uy, ux));
    if (kind === "plug") {
      cx.fillStyle = "#e9e9e6"; roundRect(0, -4, 13, 8, 2); cx.fill();
      cx.fillStyle = "#a9a9a6"; cx.fillRect(13, -2.5, 6, 5);
    } else {
      cx.strokeStyle = "#c9a54a"; cx.lineWidth = 2.2; roundRect(-2, -8, 14, 16, 2); cx.stroke();
      cx.beginPath(); cx.moveTo(5, -8); cx.lineTo(5, 8); cx.stroke();
    }
    cx.restore();
  }

  function drawFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      p.life -= dt * p.rate;
      if (p.life <= 0) { fx.splice(i, 1); continue; }
      const L = p.life;
      switch (p.k) {
        case "ring":
          p.r += dt * p.speed;
          cx.strokeStyle = `rgba(${p.color},${L * 0.7})`; cx.lineWidth = p.width;
          cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.stroke();
          break;
        case "spark":
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt;
          cx.fillStyle = `rgba(255,214,107,${L})`; cx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case "bit":
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt; p.vx *= 0.985; p.rot += p.vr * dt;
          cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.globalAlpha = Math.min(1, L * 1.5);
          cx.fillStyle = p.color; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          cx.restore();
          break;
        case "dust":
          p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.r += p.grow * dt;
          cx.fillStyle = `rgba(150,124,96,${L * 0.28})`;
          cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fill();
          break;
        case "line": {
          p.d += p.speed * dt;
          const x0 = p.x + Math.cos(p.a) * p.d, y0 = p.y + Math.sin(p.a) * p.d;
          cx.strokeStyle = `rgba(${C.ring},${L * 0.8})`; cx.lineWidth = 1.2;
          cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x0 + Math.cos(p.a) * p.len * L, y0 + Math.sin(p.a) * p.len * L); cx.stroke();
          break;
        }
        case "flash": {
          const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          const tint = p.tint || "255,236,170";
          g.addColorStop(0, `rgba(${tint},${L * 0.55})`); g.addColorStop(1, `rgba(${tint},0)`);
          cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fill();
          break;
        }
        case "star": {
          const len = p.len * (1.2 - L * 0.4);
          cx.strokeStyle = `rgba(${C.ring},${L})`; cx.lineWidth = 1;
          for (let k = 0; k < p.spikes; k++) {
            const a = p.rot + (k / p.spikes) * Math.PI * 2, l = k % 2 ? len * 0.5 : len;
            cx.beginPath(); cx.moveTo(p.x + Math.cos(a) * 3, p.y + Math.sin(a) * 3); cx.lineTo(p.x + Math.cos(a) * l, p.y + Math.sin(a) * l); cx.stroke();
          }
          break;
        }
        case "stick":
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 800 * dt; p.rot += p.vr * dt;
          cx.strokeStyle = `rgba(200,169,106,${Math.min(1, L * 1.5)})`; cx.lineWidth = 1.5;
          cx.beginPath(); cx.moveTo(p.x - Math.cos(p.rot) * p.len / 2, p.y - Math.sin(p.rot) * p.len / 2);
          cx.lineTo(p.x + Math.cos(p.rot) * p.len / 2, p.y + Math.sin(p.rot) * p.len / 2); cx.stroke();
          break;
        case "bolt": {
          cx.strokeStyle = `rgba(160,215,255,${L})`; cx.lineWidth = 1.6;
          cx.shadowColor = "#7cc7ff"; cx.shadowBlur = 10;
          cx.beginPath(); cx.moveTo(p.x, p.y);
          for (let k = 1; k <= 6; k++) {
            const d = (p.len * k) / 6, j = (Math.random() - 0.5) * 14;
            cx.lineTo(p.x + Math.cos(p.a) * d - Math.sin(p.a) * j, p.y + Math.sin(p.a) * d + Math.cos(p.a) * j);
          }
          cx.stroke(); cx.shadowBlur = 0;
          break;
        }
        case "burst": {
          p.r += p.grow * dt;
          cx.beginPath();
          for (let k = 0; k < p.spikes * 2; k++) {
            const a = p.rot + (k / (p.spikes * 2)) * Math.PI * 2, r = k % 2 ? p.r * 0.55 : p.r;
            cx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
          }
          cx.closePath();
          cx.fillStyle = `rgba(242,194,58,${L * 0.85})`; cx.fill();
          cx.strokeStyle = `rgba(20,16,10,${L})`; cx.lineWidth = 2; cx.stroke();
          break;
        }
        case "ember":
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 120 * dt; p.vx *= 0.97;
          cx.fillStyle = `rgba(255,${Math.round(120 + 100 * L)},40,${L})`;
          cx.beginPath(); cx.arc(p.x, p.y, p.size * L + 0.5, 0, Math.PI * 2); cx.fill();
          break;
        case "text":
          p.y -= dt * 60;
          cx.font = `400 ${Math.round((18 + S * 0.02) * p.size)}px ${FONT_DISPLAY}`;
          cx.textAlign = "center"; cx.globalAlpha = L; cx.fillStyle = p.color;
          cx.fillText(p.s, p.x, p.y);
          cx.globalAlpha = 1;
          break;
      }
    }
  }

  function drawAI(dt) {
    ai.wobble = Math.max(0, ai.wobble - dt * 2.2);
    ai.mood = Math.max(0, ai.mood - dt * 0.6);
    const now = performance.now(), angry = ai.mood > 0.3;
    const wob = Math.sin(now / 30) * ai.wobble * 10;
    const { w, h } = ai;
    cx.save();
    cx.translate(ai.x + wob, ai.y + Math.sin(now / 700) * 4); cx.rotate(wob * 0.01);
    cx.strokeStyle = C.robotLine; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(0, -h / 2); cx.lineTo(0, -h / 2 - 16); cx.stroke();
    cx.fillStyle = angry ? C.ember : C.accent;
    cx.beginPath(); cx.arc(0, -h / 2 - 19, 5, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = C.robot; cx.strokeStyle = C.robotLine; cx.lineWidth = 1.5;
    roundRect(-w / 2, -h / 2, w, h, 16); cx.fill(); cx.stroke();
    cx.fillStyle = C.screen; roundRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 30, 10); cx.fill();
    const eye = angry ? C.ember : C.eye, ey = -h * 0.12, ex = w * 0.18;
    cx.fillStyle = cx.strokeStyle = eye;
    if (angry) {
      cx.lineWidth = 3;
      [-1, 1].forEach((s) => { cx.beginPath(); cx.moveTo(s * ex - 7, ey - 6); cx.lineTo(s * ex + 7, ey + 6); cx.moveTo(s * ex + 7, ey - 6); cx.lineTo(s * ex - 7, ey + 6); cx.stroke(); });
    } else {
      const blink = now % 3200 < 120 ? 0.15 : 1;
      [-1, 1].forEach((s) => { cx.beginPath(); cx.ellipse(s * ex, ey, 6, 7 * blink, 0, 0, Math.PI * 2); cx.fill(); });
    }
    cx.lineWidth = 2.5; cx.beginPath();
    if (angry) cx.arc(0, h * 0.16, 9, Math.PI * 1.1, Math.PI * 1.9);
    else cx.arc(0, h * 0.06, 9, Math.PI * 0.15, Math.PI * 0.85);
    cx.stroke();
    cx.fillStyle = C.robotLine; cx.font = `500 11px ${FONT_MONO}`; cx.textAlign = "center";
    cx.fillText(angry ? "lagi kerja!!" : "mikir…", 0, h / 2 - 7);
    cx.restore();
  }
  function roundRect(x, y, w, h, r) {
    cx.beginPath(); cx.moveTo(x + r, y);
    cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
    cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
  }

  resize();
  requestAnimationFrame(frame);

  return {
    score, session, pick, use, resize,
    get variant() { return key; },
    reset() { score.crack = score.hit = score.best = 0; o.onScore?.(score); },
    rearm() { ptr.seen = false; resize(); },
    // posisi kursor dari luar (overlay tembus klik nggak dapet event mouse)
    pointer(x, y) {
      ptr.x = x; ptr.y = y;
      if (!ptr.seen) { ptr.seen = true; ptr.px = x; ptr.py = y; build(); o.onFirstMove?.(); }
    },
  };
}
