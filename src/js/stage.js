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
  // tema: "classic" = warna dari halaman, "future" = neon cyan di lantai grid
  const CLASSIC = { ...C };
  const FUTURE = { stage1: "#0a1424", stage2: "#03050a", floor: "rgba(77,227,255,0.16)", accent: "#4de3ff", ember: "#ff4fd8", ring: "77,227,255" };
  let theme = "classic";
  function setTheme(t) {
    t = t === "future" ? "future" : "classic";
    if (t === theme) return;
    theme = t;
    Object.assign(C, CLASSIC, t === "future" ? FUTURE : {});
    r3d?.setTheme?.(t);
  }

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
    r3d?.resize(W, H, dpr);
    ai.w = Math.max(72, S * (o.aiScale ?? 0.17)); ai.h = ai.w * 0.86;
    ai.x = W > 700 ? W * 0.8 : W * 0.74; ai.y = H * 0.48;
    if (!ptr.seen) { ptr.x = ptr.px = W * 0.3; ptr.y = ptr.py = H * 0.62; }
    if (mode === "click" && !auto && !dragging) { goHome(); return; }
    build();
  }
  const showAI = o.showAI ?? false;
  function build() { whip = new Whip(v, S * (o.size ?? 1), ptr, dir); }

  function pick(k) { if (!VARIANTS[k]) return; key = k; v = VARIANTS[k]; build(); warm(); }
  // pakai pecut yang udah dicustom (lihat settings.js)
  function use(variant, k = key) { key = k; v = variant; build(); warm(); }
  function warm() { o.sound.pending = v.sound; o.sound.prepare?.(v.sound); }

  // mode "follow" = pecut nempel di kursor.
  // mode "click"  = pecut nongkrong di "rumah"-nya (default pojok kanan, bisa digeser:
  //   tekan gagangnya terus seret). Tiap klik di tempat lain, pecut melesat dari rumah,
  //   nyabet titik yang diklik, terus balik lagi. Double klik = dua sabetan.
  let mode = "follow", auto = null, dragging = false;
  let home = { x: o.home?.x ?? 0.88, y: o.home?.y ?? 0.62 };
  let showWord = o.showWord ?? true;
  const homePt = () => [Math.min(W - 24, Math.max(24, home.x * W)), Math.min(H - 24, Math.max(24, home.y * H))];
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function goHome() {
    const [hx, hy] = homePt();
    ptr.x = ptr.px = hx; ptr.y = ptr.py = hy; ptr.vx = ptr.vy = 0; ptr.seen = true;
    dir.x = 0.4 * side; dir.y = -0.92; build();
  }
  // tekan di deket gagang = mulai geser rumah; tekan di tempat lain = nyabet
  function pressAt(x, y, n = 1) {
    if (mode !== "click") return;
    o.onFirstMove?.(); // sembunyiin petunjuk
    if (!auto && Math.hypot(x - ptr.x, y - ptr.y) < 34) { dragging = true; return; }
    strike(x, y, n);
  }
  function dragTo(x, y) { if (dragging) { ptr.x = x; ptr.y = y; } }
  function releaseAt() {
    if (!dragging) return;
    dragging = false;
    home = { x: ptr.x / W, y: ptr.y / H };
    o.onHomeChange?.(home);
  }
  function move(e) {
    if (mode === "click") { dragTo(...local(e)); return; }
    [ptr.x, ptr.y] = local(e);
    if (!ptr.seen) { ptr.seen = true; o.onFirstMove?.(); }
  }
  cv.addEventListener("pointermove", move);
  cv.addEventListener("pointerdown", (e) => {
    o.sound.init();
    cv.setPointerCapture?.(e.pointerId);
    if (mode === "click") { const [x, y] = local(e); pressAt(x, y, e.detail >= 2 ? 2 : 1); return; }
    move(e);
  });
  cv.addEventListener("pointerup", () => releaseAt());

  // Scroll = tali digulung ke gagang (scroll ke bawah) / diulur lagi (ke atas).
  // Udah mentok? scroll-nya diterusin ke halaman. Lepas sebentar, talinya keulur sendiri.
  const COIL_MAX = 0.72;
  let coil = 0, coilT = 0, coilAt = -1e9, coilSpin = 0;
  function wheel(e) {
    const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    const next = Math.min(COIL_MAX, Math.max(0, coilT + d * 0.0016));
    if (next === coilT) return; // mentok: biarin halaman yang scroll
    e.preventDefault();
    coilT = next; coilAt = performance.now();
  }
  if (o.wheel ?? true) cv.addEventListener("wheel", wheel, { passive: false });

  // diem kelamaan = pecutnya goyang pelan kayak ketiup angin
  let still = 0, clock = 0;

  // Tampilan 3D: fisika sama, cuma ada kedalaman (z) + digambar pakai WebGL (whip3d.js).
  // Semua pecut punya versi 3D; WebGL nggak ada = otomatis tetap 2D.
  let view3d = false, r3d = null, r3dLoad = null, dz = 0;
  const is3D = () => view3d && r3d;
  function load3D() {
    r3dLoad ||= import("./whip3d.js")
      .then((m) => { r3d = m.createWhip3D(); if (r3d) { r3d.resize(W, H, window.devicePixelRatio); r3d.setTheme(theme); } return !!r3d; })
      .catch((e) => { console.warn("3D nggak bisa dimuat", e); return false; });
    return r3dLoad;
  }
  async function set3D(on) {
    view3d = !!on;
    if (!view3d) { dz = 0; build(); return false; }
    const ok = await load3D();
    if (!ok) view3d = false;
    return ok;
  }

  // Sabetan otomatis (mode klik), kayak orang mecut beneran:
  //   1. melesat ke posisi ancang-ancang: gagang mundur menjauh dari target
  //   2. sentak ke depan terus berhenti mendadak -> tali menggulung keluar ke arah target
  //   3. ujung tali dituntun dikit ke titik klik; ctarr meledak pas ujungnya nyampe
  //   4. tahan sebentar, terus balik pulang
  function strike(x, y, n = 1) {
    if (!ptr.seen) { ptr.seen = true; o.onFirstMove?.(); }
    if (auto && !auto.fired) { auto.next = { x, y, n }; return; } // double klik: tunggu giliran
    const reach = v.len * S * (o.size ?? 1) + whip.handleLen;
    // gagang dateng dari bawah-samping (sisi yang jauh dari tengah layar)
    const s = x < W * 0.5 ? 1 : -1;
    let ux = -s * 0.55, uy = -0.83; // arah dari gagang ke target
    const cl = (q, m) => Math.min(m - 16, Math.max(16, q));
    const end = [cl(x - ux * reach * 0.82, W), cl(y - uy * reach * 0.82, H)];
    // kalau mentok pinggir layar, arahnya disesuaiin biar tetap ngadep target
    const dx = x - end[0], dy = y - end[1], dl = Math.hypot(dx, dy) || 1;
    ux = dx / dl; uy = dy / dl;
    const wind = [cl(end[0] - ux * reach * 0.42 - uy * s * reach * 0.12, W), cl(end[1] - uy * reach * 0.42 + ux * s * reach * 0.12, H)];
    auto = { t: 0, x, y, n, fired: false, from: [ptr.x, ptr.y], wind, end, reach, min: 1e9 };
    const far = Math.hypot(wind[0] - ptr.x, wind[1] - ptr.y);
    auto.travel = Math.min(0.22, 0.1 + far / 5000);
    // tanda kecil di titik yang diklik
    fx.push({ k: "ring", x, y, r: 3, speed: 70, width: 1.2, color: C.ring, life: 1, rate: 3.2 });
  }
  function driveAuto(dt) {
    const a = auto; a.t += dt;
    const T = a.travel, SNAP = 0.11, HOLD = 0.2, BACK = 0.36;
    const lerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    const ease = (f) => (f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f));
    let pos;
    if (a.t < T) pos = lerp(a.from, a.wind, ease(a.t / T));
    else if (a.t < T + SNAP) { const f = (a.t - T) / SNAP; pos = lerp(a.wind, a.end, 1 - (1 - f) ** 3); } // cepet, berhenti mendadak
    else if (a.t < T + SNAP + HOLD) pos = a.end;
    else pos = lerp(a.end, homePt(), ease(Math.min(1, (a.t - T - SNAP - HOLD) / BACK)));
    [ptr.x, ptr.y] = pos;

    // tuntun ujung tali ke target selama sentakan
    const live = a.t >= T * 0.6 && a.t < T + SNAP + HOLD * 0.7;
    whip.attract = live ? { x: a.x, y: a.y, k: a.t < T ? 0.006 : 0.03 } : null;

    if (!a.fired && a.t >= T) {
      const tp = whip.tip(), d = Math.hypot(tp.x - a.x, tp.y - a.y);
      const near = Math.max(14, a.reach * 0.05);
      const passed = a.t > T + SNAP * 0.5 && a.min < near * 3 && d > a.min + 3; // udah lewat titik terdekat
      a.min = Math.min(a.min, d);
      if (d < near || passed || a.t >= T + SNAP + HOLD * 0.8) {
        a.fired = true; crackCool = 0.3;
        onCrack(a.n >= 2 ? 1.7 : 1.3, { x: a.x, y: a.y });
      }
    }
    if (a.next && a.fired && a.t > T + SNAP + 0.06) { const q = a.next; auto = null; whip.attract = null; strike(q.x, q.y, q.n); return; }
    if (a.t > T + SNAP + HOLD + BACK) { auto = null; whip.attract = null; }
  }
  let lastCrackAt = -99;
  function onCrack(mach, at) {
    const t = at || whip.tip();
    lastCrackAt = clock;
    score.crack++; session.crack++; score.best = Math.max(score.best, mach); o.onScore?.(score);
    o.sound.crack(mach - 1, v.sound, (t.x / W) * 2 - 1);
    shake = reduced ? 0 : (6 + Math.min(10, (mach - 1) * 8)) * (v.shake ?? 1);
    const big = mach > 1.4;
    if (showWord) fx.push({ k: "text", x: t.x, y: t.y - 12, life: 1, rate: 1.4, s: big && v.word.endsWith("!") ? v.word + "!" : v.word, color: v.color, size: v.fx === "star" ? 0.75 : v.fx === "dust" ? 1.25 : 1 });
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
      case "pulse": // denyut plasma: kilat cyan + cincin berlapis + percikan listrik
        add({ k: "flash", r: 60 + mach * 30, rate: 4, tint: "77,227,255" });
        add({ k: "ring", r: 2, speed: 760, width: 2.5, color: "77,227,255", rate: 2.6 });
        add({ k: "ring", r: 2, speed: 430, width: 1.2, color: "234,252,255", rate: 2 });
        for (let i = 0; i < 4; i++) add({ k: "bolt", a: rnd(0, Math.PI * 2), len: rnd(30, 70) * Math.min(1.5, mach), rate: rnd(4, 6) });
        break;
      case "glitch": { // pixel pecah warna-warni
        const cols = ["77,227,255", "255,79,216", "138,125,255"];
        add({ k: "flash", r: 50 + mach * 20, rate: 5, tint: "138,125,255" });
        for (let i = 0; i < 22; i++) add({ k: "pixel", x: t.x + rnd(-70, 70), y: t.y + rnd(-45, 45), w: rnd(4, 26), h: rnd(2, 9), color: cols[i % 3], rate: rnd(2, 4) });
        for (let i = 0; i < 4; i++) add({ k: "pixel", x: t.x + rnd(-20, 20), y: t.y + rnd(-35, 35), w: rnd(90, 220), h: rnd(2, 4), color: cols[i % 3], rate: 5 });
        break;
      }
      case "droplets": // cipratan tetesan krom
        add({ k: "flash", r: 40 + mach * 20, rate: 5, tint: "235,240,245" });
        add({ k: "ring", r: 3, speed: 380, width: 1.5, color: "220,228,236", rate: 2.6 });
        for (let i = 0; i < 16; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(140, 420);
          add({ k: "drop", vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rnd(1.8, 4.5), rate: rnd(1, 1.6) });
        }
        break;
      case "energy": // ledakan energi amber dari rantai
        add({ k: "flash", r: 60 + mach * 30, rate: 4, tint: "255,176,46" });
        add({ k: "ring", r: 3, speed: 520, width: 2.5, color: "255,176,46", rate: 2.4 });
        add({ k: "ring", r: 3, speed: 300, width: 1, color: "255,236,200", rate: 2 });
        for (let i = 0; i < 18; i++) {
          const a = rnd(0, Math.PI * 2), sp = rnd(140, 420);
          add({ k: "spark", vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rnd(2, 3.5), rate: rnd(1.4, 2.2) });
        }
        break;
      case "lightning": // petir bercabang ke mana-mana
        add({ k: "flash", r: 90 + mach * 40, rate: 4.5, tint: "159,212,255" });
        for (let i = 0; i < 9; i++) add({ k: "bolt", a: rnd(0, Math.PI * 2), len: rnd(60, 150) * Math.min(1.5, mach), rate: rnd(3.5, 5.5) });
        break;
      case "warp": // gelombang gelap + serpihan kesedot ke tengah
        add({ k: "void", r: 4, grow: 260, rate: 1.8 });
        add({ k: "ring", r: 4, speed: 600, width: 2, color: "178,107,255", rate: 2.2 });
        for (let i = 0; i < 28; i++) add({ k: "suck", a: rnd(0, Math.PI * 2), d: rnd(70, 170), spin: rnd(2, 4), color: i % 3 ? "178,107,255" : "255,154,60", rate: rnd(1.4, 2.2) });
        break;
      case "rainbow": // cincin + serpihan warna-warni
        ["255,122,217", "77,227,255", "255,214,107"].forEach((c, i) => add({ k: "ring", r: 3, speed: 520 - i * 120, width: 2, color: c, rate: 2.4 }));
        for (let i = 0; i < 24; i++) {
          const a = rnd(0, Math.PI * 2), sp = rnd(150, 420);
          add({ k: "bit", vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, w: rnd(3, 6), h: rnd(3, 6), rot: rnd(0, 6), vr: rnd(-8, 8), color: `hsl(${(i * 37) % 360},100%,62%)`, rate: rnd(1, 1.6) });
        }
        break;
      case "welding": // percikan las yang jatuh
        add({ k: "flash", r: 45 + mach * 20, rate: 5, tint: "255,207,90" });
        for (let i = 0; i < 32; i++) {
          const a = rnd(-Math.PI, 0.3), sp = rnd(160, 560);
          add({ k: "weld", vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rate: rnd(1.2, 2.2) });
        }
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
    if (auto) driveAuto(dt);
    clock += dt;

    // gulungan: dikejar halus. Selama lagi digulung/diulur nggak boleh ctarr.
    if (now - coilAt > 1600) coilT = Math.max(0, coilT - dt * 0.35);
    const dc = (coilT - coil) * Math.min(1, dt * 12);
    coil += dc; coilSpin += dc * 40;
    whip.k = 1 - coil;
    if (Math.abs(coilT - coil) > 0.004) crackCool = Math.max(crackCool, 0.2);

    // arah gagang ikut arah ayunan tangan. Kalau diam, gagang tegak dan miring dikit
    // ke sisi terakhir lu ngayun (kiri atau kanan), jadi bisa nyabet ke dua arah.
    ptr.vx += ((ptr.x - ptr.px) / dt - ptr.vx) * 0.35;
    ptr.vy += ((ptr.y - ptr.py) / dt - ptr.vy) * 0.35;
    if (Math.abs(ptr.vx) > 250) side += (Math.sign(ptr.vx) - side) * 0.2;
    const moving = Math.abs(ptr.vx) + Math.abs(ptr.vy) > 12 || auto || dragging;
    still = moving ? 0 : still + dt;
    const sway = reduced || !(o.idle ?? true) ? 0 : Math.min(1, Math.max(0, (still - 1.5) / 2));
    whip.wind = sway * S * (1.1 * Math.sin(clock * 0.9) + 0.5 * Math.sin(clock * 2.3 + 1));
    const rx = 0.4 * side + sway * (0.16 * Math.sin(clock * 1.4) + 0.06 * Math.sin(clock * 3.1)), ry = -Math.sqrt(1 - rx * rx);
    let tx = rx * 260 + ptr.vx * 0.6, ty = ry * 260 + ptr.vy * 0.6;
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const ox = dir.x, oy = dir.y;
    dir.x += (tx - dir.x) * 0.3; dir.y += (ty - dir.y) * 0.3;
    const dl = Math.hypot(dir.x, dir.y) || 1; dir.x /= dl; dir.y /= dl;

    // 3D: gagang agak nyondong ke depan, makin kenceng ngayun makin keluar layar
    const d3 = is3D(), oz = dz;
    if (d3) {
      const tz = 0.35 + Math.max(-0.35, Math.min(0.35, (ptr.vx * side) / 5000)) + sway * 0.25 * Math.sin(clock * 1.1);
      dz += (tz - dz) * 0.2;
    } else dz = 0;
    whip.windZ = d3 ? sway * S * 0.9 * Math.sin(clock * 0.7 + 2) : 0;

    const sub = Math.max(2, Math.ceil(dt * 240)), h = dt / sub;
    let tip = 0;
    for (let s = 1; s <= sub; s++) {
      const f = s / sub;
      const bx = ptr.px + (ptr.x - ptr.px) * f, by = ptr.py + (ptr.y - ptr.py) * f;
      const ddx = ox + (dir.x - ox) * f, ddy = oy + (dir.y - oy) * f;
      const ddz = oz + (dz - oz) * f, hl = whip.handleLen / Math.sqrt(1 + ddz * ddz);
      tip = Math.max(tip, whip.step(h, bx, by, bx + ddx * hl, by + ddy * hl, 0, ddz * hl));
    }
    ptr.px = ptr.x; ptr.py = ptr.y;

    const mach = tip / v.threshold;
    machShown = Math.max(mach, machShown * 0.9);
    crackCool -= dt; hitCool -= dt;
    const above = mach >= 1;
    let cracked = false;
    if (above && !prevAbove && crackCool <= 0 && mode === "follow") { onCrack(mach); crackCool = 0.28; cracked = true; }
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
      if (theme === "future") drawGrid();
      else for (let i = 0; i < 6; i++) { const y = H * 0.78 + i * i * 6; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
    }
    if (shake > 0) {
      cx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.82; if (shake < 0.3) shake = 0;
    }
    if (showAI) drawAI(dt);
    if (is3D()) {
      if (coil > 0.01) drawCoil();
      cx.drawImage(r3d.render(whip, { x: ptr.x, y: ptr.y, z: 0 }, v, S, clock, clock - lastCrackAt), 0, 0, W, H);
      drawExtras(true);
    } else {
      drawHandle();
      if (coil > 0.01) drawCoil();
      drawRope();
      drawExtras(false);
    }
    if (mode === "click" && !auto) drawHomeRing();
    drawFx(dt);
    cx.restore();
    if ((o.cursorDot ?? true) && mode === "follow") {
      cx.fillStyle = theme === "future" ? "rgba(160,240,255,0.95)" : "rgba(243,231,211,0.9)";
      cx.beginPath(); cx.arc(ptr.x, ptr.y, 4, 0, Math.PI * 2); cx.fill();
    }
  }

  // lantai grid neon yang jalan pelan ke arah kamera
  function drawGrid() {
    const hz = H * 0.62, vx = W / 2;
    cx.beginPath();
    for (let i = -12; i <= 12; i++) { cx.moveTo(vx + i * W * 0.02, hz); cx.lineTo(vx + i * W * 0.16, H); }
    const off = (clock * 0.35) % 1;
    for (let i = 0; i < 9; i++) { const f = (i + off) / 9, y = hz + (H - hz) * f * f; cx.moveTo(0, y); cx.lineTo(W, y); }
    cx.stroke();
    const glow = cx.createLinearGradient(0, hz - 40, 0, hz + 30);
    glow.addColorStop(0, "rgba(77,227,255,0)"); glow.addColorStop(0.6, "rgba(77,227,255,0.10)"); glow.addColorStop(1, "rgba(77,227,255,0)");
    cx.fillStyle = glow; cx.fillRect(0, hz - 40, W, 70);
  }

  // lingkaran tipis di gagang: tanda pecut bisa digeser
  function drawHomeRing() {
    const pulse = dragging ? 1 : 0.35 + Math.sin(performance.now() / 600) * 0.15;
    cx.strokeStyle = `rgba(${C.ring},${pulse})`; cx.lineWidth = 1; cx.setLineDash([3, 4]);
    cx.beginPath(); cx.arc(ptr.x, ptr.y, 16, 0, Math.PI * 2); cx.stroke(); cx.setLineDash([]);
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

  // gulungan tali di ujung gagang, makin banyak digulung makin tebel
  function drawCoil() {
    const hx = whip.x[0], hy = whip.y[0], w = Math.max(2, v.strands ? v.w0 + 1 : v.w0);
    const a0 = Math.atan2(hy - ptr.y, hx - ptr.x), turns = 0.6 + coil * 5;
    const r0 = Math.max(5, S * 0.012), step = w * 1.15;
    const ca = Math.cos(a0), sa = Math.sin(a0);
    cx.save(); cx.lineCap = "round";
    for (const pass of [0, 1]) {
      cx.beginPath();
      for (let a = 0; a <= turns * Math.PI * 2; a += 0.2) {
        const r = r0 + (step * a) / (Math.PI * 2), q = a + coilSpin;
        // elips miring ngikut gagang, biar kesannya ngelilit
        const ex = Math.cos(q) * r * 0.55, ey = Math.sin(q) * r;
        const px = hx + ex * ca - ey * sa, py = hy + ex * sa + ey * ca;
        a ? cx.lineTo(px, py) : cx.moveTo(px, py);
      }
      cx.strokeStyle = pass ? v.rope : "rgba(0,0,0,0.45)";
      cx.lineWidth = pass ? w : w + 2;
      cx.stroke();
    }
    cx.restore();
  }

  function drawRope() {
    const { x, y, n } = whip;
    if (v.strands) return drawStrands();
    if (v.robot) return drawRobot();
    if (v.chain) return drawChain();
    // hologram: kedip + kadang kepecah warna (RGB split)
    let holoA = 1;
    if (v.holo) {
      holoA = 0.55 + 0.25 * Math.sin(clock * 23) * Math.sin(clock * 7.3);
      if (!reduced && Math.random() < 0.05) {
        cx.save(); cx.globalCompositeOperation = "lighter"; cx.lineCap = "round";
        for (const [c, off] of [["rgba(255,79,216,0.5)", -4], ["rgba(77,227,255,0.5)", 4]]) {
          cx.strokeStyle = c; cx.lineWidth = v.w0 * 0.8; cx.beginPath();
          for (let i = 0; i < n; i++) i ? cx.lineTo(x[i] + off, y[i]) : cx.moveTo(x[i] + off, y[i]);
          cx.stroke();
        }
        cx.restore();
      }
      cx.globalAlpha = holoA;
    }
    if (v.glow) {
      cx.shadowColor = typeof v.glow === "string" ? v.glow : "#ffd36b";
      cx.shadowBlur = 14 + Math.min(30, machShown * 18);
    }
    cx.strokeStyle = v.rope;
    cx.lineCap = v.flat ? "butt" : "round";
    if (v.fiber) { cx.strokeStyle = "rgba(232,247,255,0.35)"; }
    for (let i = 0; i < n - 1; i++) {
      const f = i / (n - 1);
      // logam cair: ketebalannya beriak jalan sepanjang tali
      cx.lineWidth = (v.w0 + (v.w1 - v.w0) * Math.pow(f, 0.7)) * (v.chrome ? 1 + 0.22 * Math.sin(f * 18 - clock * 9) : 1);
      cx.beginPath(); cx.moveTo(x[i], y[i]); cx.lineTo(x[i + 1], y[i + 1]); cx.stroke();
    }
    cx.lineCap = "round";
    cx.shadowBlur = 0;
    if (v.chrome) {
      // kilap: garis terang tipis di sisi atas + bayangan gelap di sisi bawah
      for (const [c, k, wd] of [["rgba(40,46,54,0.55)", 0.3, 1.6], ["rgba(255,255,255,0.85)", -0.28, 1.2]]) {
        cx.strokeStyle = c; cx.lineWidth = wd; cx.beginPath();
        for (let i = 0; i < n; i++) {
          const j = Math.min(n - 1, Math.max(1, i)), ddx = x[j] - x[j - 1], ddy = y[j] - y[j - 1], ll = Math.hypot(ddx, ddy) || 1;
          const w = (v.w0 + (v.w1 - v.w0) * Math.pow(i / (n - 1), 0.7)) * k;
          const px = x[i] - (ddy / ll) * w, py = y[i] + (ddx / ll) * w;
          i ? cx.lineTo(px, py) : cx.moveTo(px, py);
        }
        cx.stroke();
      }
    }
    cx.globalAlpha = 1;
    if (v.flat) {
      // jahitan tengah sabuk
      cx.strokeStyle = "rgba(236,232,225,0.35)"; cx.lineWidth = 1; cx.setLineDash([3, 4]);
      cx.beginPath(); cx.moveTo(x[0], y[0]);
      for (let i = 1; i < n; i++) cx.lineTo(x[i], y[i]);
      cx.stroke(); cx.setLineDash([]);
    } else if (!v.plug && !v.chrome && !v.holo && !v.fiber && !v.void && !v.core) {
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
    if (v.void || v.fiber) return; // ujungnya digambar di drawExtras
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

  // rantai energi: mata rantai gantian (lingkaran / tampak samping), sambungannya nyala.
  // Abis ctarr, nyala energinya jalan dari gagang ke ujung.
  function drawChain() {
    const { x, y, n } = whip, wave = (clock - lastCrackAt) * 2.6;
    for (let i = 0; i < n - 1; i++) {
      const dx = x[i + 1] - x[i], dy = y[i + 1] - y[i], L = Math.hypot(dx, dy) || 1;
      const w = (v.w0 + (v.w1 - v.w0) * (i / (n - 1))) * 0.6;
      cx.save(); cx.translate((x[i] + x[i + 1]) / 2, (y[i] + y[i + 1]) / 2); cx.rotate(Math.atan2(dy, dx));
      cx.strokeStyle = v.rope; cx.fillStyle = v.rope;
      if (i % 2) { cx.lineWidth = 2.4; cx.beginPath(); cx.ellipse(0, 0, L * 0.62, w, 0, 0, Math.PI * 2); cx.stroke(); }
      else { cx.beginPath(); cx.ellipse(0, 0, L * 0.62, 1.8, 0, 0, Math.PI * 2); cx.fill(); }
      cx.restore();
    }
    cx.shadowColor = v.chain; cx.shadowBlur = 10; cx.fillStyle = v.chain;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1), pulse = Math.exp(-((f - wave) ** 2) * 30);
      cx.globalAlpha = Math.min(1, 0.35 + pulse + machShown * 0.2);
      cx.beginPath(); cx.arc(x[i], y[i], 1.6 + pulse * 2.5, 0, Math.PI * 2); cx.fill();
    }
    cx.globalAlpha = 1; cx.shadowBlur = 0;
  }

  // lengan robot: ruas logam kaku, engsel baut, capit di ujung
  function drawRobot() {
    const { x, y, n } = whip;
    cx.lineCap = "round";
    for (let i = 0; i < n - 1; i++) {
      const w = v.w0 + (v.w1 - v.w0) * (i / (n - 1));
      cx.strokeStyle = "#1c2026"; cx.lineWidth = w + 3;
      cx.beginPath(); cx.moveTo(x[i], y[i]); cx.lineTo(x[i + 1], y[i + 1]); cx.stroke();
      cx.strokeStyle = v.rope; cx.lineWidth = w;
      cx.beginPath(); cx.moveTo(x[i], y[i]); cx.lineTo(x[i + 1], y[i + 1]); cx.stroke();
      cx.strokeStyle = "rgba(255,255,255,0.35)"; cx.lineWidth = 1.2;
      cx.beginPath(); cx.moveTo(x[i], y[i] - w * 0.25); cx.lineTo(x[i + 1], y[i + 1] - w * 0.25); cx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const w = v.w0 + (v.w1 - v.w0) * (i / (n - 1));
      cx.fillStyle = "#2a2f37"; cx.beginPath(); cx.arc(x[i], y[i], w * 0.62, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = "#c9d1da"; cx.beginPath(); cx.arc(x[i], y[i], w * 0.2, 0, Math.PI * 2); cx.fill();
    }
    const t = n - 1, a = Math.atan2(y[t] - y[t - 1], x[t] - x[t - 1]), open = 0.35 + Math.min(0.4, machShown * 0.3);
    cx.strokeStyle = "#c9d1da"; cx.lineWidth = 3;
    for (const s of [-1, 1]) {
      const b = a + s * open;
      cx.beginPath(); cx.moveTo(x[t], y[t]);
      cx.lineTo(x[t] + Math.cos(b) * 12, y[t] + Math.sin(b) * 12);
      cx.lineTo(x[t] + Math.cos(a) * 17, y[t] + Math.sin(a) * 17); cx.stroke();
    }
  }

  // tambahan yang digambar di atas tali (juga di mode 3D): listrik tesla, denyut fiber,
  // cakram lubang hitam (2D aja, di 3D udah jadi model)
  function drawExtras(d3) {
    const { x, y, n } = whip, t = n - 1;
    if (v.arcs && !reduced) {
      cx.save(); cx.strokeStyle = v.arcs; cx.shadowColor = v.arcs; cx.shadowBlur = 8; cx.lineWidth = 1.2;
      const count = 1 + Math.floor(Math.random() * 2) + Math.floor(machShown * 3);
      for (let k = 0; k < count; k++) {
        const i = 2 + Math.floor(Math.random() * (n - 4)), j = Math.min(t, i + 2 + Math.floor(Math.random() * 4));
        cx.globalAlpha = 0.5 + Math.random() * 0.5; cx.beginPath(); cx.moveTo(x[i], y[i]);
        for (let m = 1; m < 5; m++) {
          const f = m / 5, px = x[i] + (x[j] - x[i]) * f, py = y[i] + (y[j] - y[i]) * f;
          cx.lineTo(px + (Math.random() - 0.5) * 16, py + (Math.random() - 0.5) * 16);
        }
        cx.lineTo(x[j], y[j]); cx.stroke();
      }
      cx.restore();
    }
    if (v.fiber) {
      // denyut cahaya warna-warni jalan dari gagang ke ujung, makin kenceng diayun makin cepet
      const speed = 0.5 + machShown * 2.2;
      cx.save(); cx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 6; k++) {
        const f = (clock * speed + k / 6) % 1, i = f * t, a = Math.floor(i), b = Math.min(t, a + 1), r = i - a;
        const px = x[a] + (x[b] - x[a]) * r, py = y[a] + (y[b] - y[a]) * r, hue = (k * 60 + clock * 120) % 360;
        cx.fillStyle = `hsl(${hue},100%,65%)`; cx.shadowColor = cx.fillStyle; cx.shadowBlur = 12;
        cx.beginPath(); cx.arc(px, py, 3.2, 0, Math.PI * 2); cx.fill();
      }
      cx.fillStyle = `hsl(${(clock * 200) % 360},100%,75%)`; cx.shadowColor = cx.fillStyle; cx.shadowBlur = 16;
      cx.beginPath(); cx.arc(x[t], y[t], 3.5 + machShown * 2, 0, Math.PI * 2); cx.fill();
      cx.restore();
    }
    if (v.void && !d3) {
      // cakram cahaya muter di ujung, tengahnya hitam pekat
      cx.save(); cx.translate(x[t], y[t]); cx.rotate(clock * 2.5);
      cx.shadowColor = v.glow; cx.shadowBlur = 14;
      const g = cx.createLinearGradient(-12, 0, 12, 0);
      g.addColorStop(0, "#ff9a3c"); g.addColorStop(0.5, v.glow); g.addColorStop(1, "#ff9a3c");
      cx.strokeStyle = g; cx.lineWidth = 2.6;
      cx.beginPath(); cx.ellipse(0, 0, 13, 4.5, 0, 0, Math.PI * 2); cx.stroke();
      cx.shadowBlur = 0; cx.fillStyle = "#000"; cx.beginPath(); cx.arc(0, 0, 4.5, 0, Math.PI * 2); cx.fill();
      cx.restore();
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
        case "pixel":
          cx.fillStyle = `rgba(${p.color},${L * 0.85})`;
          cx.fillRect(p.x - p.w / 2 + (Math.random() - 0.5) * 6, p.y - p.h / 2, p.w, p.h);
          break;
        case "drop": {
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt;
          const g = cx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 0, p.x, p.y, p.r);
          g.addColorStop(0, `rgba(255,255,255,${L})`); g.addColorStop(0.5, `rgba(200,208,216,${L})`); g.addColorStop(1, `rgba(90,98,108,${L})`);
          cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fill();
          break;
        }
        case "void":
          p.r += p.grow * dt;
          cx.fillStyle = `rgba(8,2,18,${L * 0.45})`; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fill();
          cx.strokeStyle = `rgba(178,107,255,${L * 0.6})`; cx.lineWidth = 3; cx.stroke();
          break;
        case "suck": {
          p.d *= 1 - dt * 3.2; p.a += p.spin * dt;
          const sx = p.x + Math.cos(p.a) * p.d, sy = p.y + Math.sin(p.a) * p.d;
          cx.fillStyle = `rgba(${p.color},${L})`; cx.beginPath(); cx.arc(sx, sy, 1.2 + L * 1.6, 0, Math.PI * 2); cx.fill();
          break;
        }
        case "weld":
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.vx *= 0.99;
          cx.strokeStyle = `rgba(255,${Math.round(180 + 70 * L)},${Math.round(90 + 140 * L)},${L})`; cx.lineWidth = 1.6;
          cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); cx.stroke();
          break;
        case "ember":
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 120 * dt; p.vx *= 0.97;
          cx.fillStyle = `rgba(255,${Math.round(120 + 100 * L)},40,${L})`;
          cx.beginPath(); cx.arc(p.x, p.y, p.size * L + 0.5, 0, Math.PI * 2); cx.fill();
          break;
        case "text":
          p.y -= dt * 60;
          cx.font = `700 ${Math.round((18 + S * 0.02) * p.size)}px ${theme === "future" ? "ui-monospace, Menlo, Consolas, monospace" : FONT_DISPLAY}`;
          cx.textAlign = "center"; cx.globalAlpha = L; cx.fillStyle = p.color;
          if (theme === "future") { cx.shadowColor = p.color; cx.shadowBlur = 18; }
          cx.fillText(p.s, p.x, p.y);
          cx.globalAlpha = 1; cx.shadowBlur = 0;
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
    setMode(m) { mode = m === "click" ? "click" : "follow"; auto = null; dragging = false; if (mode === "click") goHome(); else build(); },
    setHome(h) { if (h && isFinite(h.x) && isFinite(h.y)) { home = { x: h.x, y: h.y }; if (mode === "click" && !auto && !dragging) goHome(); } },
    setShowWord(b) { showWord = !!b; },
    set3D, setTheme,
    get is3D() { return view3d; },
    strike, pressAt, releaseAt,
    get mode() { return mode; },
    get tip() { return whip.tip(); },
    pointer(x, y) {
      if (mode === "click") { dragTo(x, y); return; }
      ptr.x = x; ptr.y = y;
      if (!ptr.seen) { ptr.seen = true; ptr.px = x; ptr.py = y; build(); o.onFirstMove?.(); }
    },
  };
}
