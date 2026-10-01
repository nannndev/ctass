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

  let W = 0, H = 0, S = 0;
  let key = "jaranan", v = VARIANTS[key], whip;
  const ptr = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, seen: false };
  const dir = { x: 0.45, y: -0.89 };
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
  function build() { whip = new Whip(v, S, ptr, dir); }

  function move(e) {
    const r = cv.getBoundingClientRect();
    ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
    if (!ptr.seen) { ptr.seen = true; o.onFirstMove?.(); }
  }
  cv.addEventListener("pointermove", move);
  cv.addEventListener("pointerdown", (e) => { o.sound.init(); move(e); cv.setPointerCapture?.(e.pointerId); });

  function pick(k) { if (!VARIANTS[k]) return; key = k; v = VARIANTS[k]; build(); }

  function onCrack(mach) {
    const t = whip.tip();
    score.crack++; session.crack++; score.best = Math.max(score.best, mach); o.onScore?.(score);
    o.sound.crack(mach - 1, v.pitch);
    shake = reduced ? 0 : 6 + Math.min(10, (mach - 1) * 8);
    fx.push({ k: "ring", x: t.x, y: t.y, r: 4, life: 1 });
    fx.push({ k: "text", x: t.x, y: t.y - 10, life: 1, s: mach > 1.4 ? "CTARR!!" : "CTARR!" });
    if (v.glow && !reduced) for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 380;
      fx.push({ k: "spark", x: t.x, y: t.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
    }
  }
  function onHit(cracked) {
    score.hit++; session.hit++; o.onScore?.(score);
    ai.wobble = 1; ai.mood = 1; o.sound.thud();
    o.onSay?.(AI_LINES[Math.floor(Math.random() * AI_LINES.length)], ai.x, ai.y - ai.h * 0.62);
    if (!cracked) fx.push({ k: "text", x: ai.x, y: ai.y - ai.h / 2, life: 1, s: "PLAK!" });
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

    // arah gagang ikut arah ayunan tangan, balik ke posisi santai kalau diam
    ptr.vx += ((ptr.x - ptr.px) / dt - ptr.vx) * 0.35;
    ptr.vy += ((ptr.y - ptr.py) / dt - ptr.vy) * 0.35;
    let tx = 0.45 * 500 + ptr.vx * 0.5, ty = -0.89 * 500 + ptr.vy * 0.5;
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
    if (mach > 0.45 && hitCool <= 0 && tipInAI()) { onHit(cracked); hitCool = 0.6; }

    o.sound.whoosh(mach, v.pitch);
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
      gr.addColorStop(0, "#2a2018"); gr.addColorStop(1, "#120e0b");
      cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
      cx.strokeStyle = "rgba(168,149,124,0.08)"; cx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const y = H * 0.78 + i * i * 6; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
    }
    if (shake > 0) {
      cx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.82; if (shake < 0.3) shake = 0;
    }
    drawAI(dt);
    drawHandle();
    drawRope();
    drawFx(dt);
    cx.restore();
    cx.fillStyle = "rgba(243,231,211,0.9)";
    cx.beginPath(); cx.arc(ptr.x, ptr.y, 4, 0, Math.PI * 2); cx.fill();
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
    if (v.glow) { cx.shadowColor = "#ffd36b"; cx.shadowBlur = 14 + Math.min(30, machShown * 18); }
    cx.strokeStyle = v.rope;
    for (let i = 0; i < n - 1; i++) {
      cx.lineWidth = v.w0 + (v.w1 - v.w0) * Math.pow(i / (n - 1), 0.7);
      cx.beginPath(); cx.moveTo(x[i], y[i]); cx.lineTo(x[i + 1], y[i + 1]); cx.stroke();
    }
    cx.shadowBlur = 0;
    // anyaman
    cx.strokeStyle = "rgba(0,0,0,0.28)"; cx.lineWidth = 1;
    for (let i = 1; i < n - 3; i += 2) {
      const dx = x[i + 1] - x[i], dy = y[i + 1] - y[i], l = Math.hypot(dx, dy) || 1;
      const w = (v.w0 + (v.w1 - v.w0) * (i / (n - 1))) * 0.5;
      cx.beginPath(); cx.moveTo(x[i] - (dy / l) * w, y[i] + (dx / l) * w);
      cx.lineTo(x[i] + (dy / l) * w + dx * 0.4, y[i] - (dx / l) * w + dy * 0.4); cx.stroke();
    }
    // cracker di ujung
    const t = n - 1, dx = x[t] - x[t - 1], dy = y[t] - y[t - 1], l = Math.hypot(dx, dy) || 1;
    cx.strokeStyle = v.glow ? "#fff3c4" : "#efe6d6"; cx.lineWidth = 1.2;
    for (let k = -1; k <= 1; k++) {
      cx.beginPath(); cx.moveTo(x[t], y[t]);
      cx.lineTo(x[t] + (dx / l) * 14 + (-dy / l) * k * 3, y[t] + (dy / l) * 14 + (dx / l) * k * 3 + 3);
      cx.stroke();
    }
  }

  function drawFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      p.life -= dt * (p.k === "text" ? 1.4 : 2.2);
      if (p.life <= 0) { fx.splice(i, 1); continue; }
      if (p.k === "ring") {
        p.r += dt * 520;
        cx.strokeStyle = `rgba(255,236,200,${p.life * 0.8})`; cx.lineWidth = 2;
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.stroke();
      } else if (p.k === "spark") {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt;
        cx.fillStyle = `rgba(255,214,107,${p.life})`; cx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      } else {
        p.y -= dt * 60;
        cx.font = `400 ${Math.round(18 + S * 0.02)}px ${FONT_DISPLAY}`;
        cx.textAlign = "center"; cx.fillStyle = `rgba(255,107,61,${p.life})`;
        cx.fillText(p.s, p.x, p.y);
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
    cx.strokeStyle = "#a8957c"; cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(0, -h / 2); cx.lineTo(0, -h / 2 - 16); cx.stroke();
    cx.fillStyle = angry ? "#ff6b3d" : "#e8a23a";
    cx.beginPath(); cx.arc(0, -h / 2 - 19, 5, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = "#3a2c21"; cx.strokeStyle = "#a8957c"; cx.lineWidth = 2;
    roundRect(-w / 2, -h / 2, w, h, 16); cx.fill(); cx.stroke();
    cx.fillStyle = "#120e0b"; roundRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 30, 10); cx.fill();
    const eye = angry ? "#ff6b3d" : "#8fe3c2", ey = -h * 0.12, ex = w * 0.18;
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
    cx.fillStyle = "#a8957c"; cx.font = `500 11px ${FONT_MONO}`; cx.textAlign = "center";
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
    score, session, pick, resize,
    get variant() { return key; },
    reset() { score.crack = score.hit = score.best = 0; o.onScore?.(score); },
    rearm() { ptr.seen = false; resize(); },
  };
}
