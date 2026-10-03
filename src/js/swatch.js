// Gambar kecil sebuah pecut (dipakai di kartu landing & jendela pengaturan).
export function drawSwatch(c, v) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = c.clientWidth || 220, h = c.clientHeight || 70;
  c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext("2d"); g.scale(dpr, dpr); g.lineCap = "round";
  g.clearRect(0, 0, w, h);
  const hx = 12, hy = h - 12, ex = 12 + Math.max(0.07, v.handle) * 140, ey = h - 12 - Math.max(0.07, v.handle) * 84;
  g.strokeStyle = v.grip; g.lineWidth = 8; g.beginPath(); g.moveTo(hx, hy); g.lineTo(ex, ey); g.stroke();
  const len = (w - ex - 14) * Math.min(1, v.len / 0.78), N = 40;
  const pt = (t) => [ex + t * len, ey - Math.sin(t * Math.PI) * (h * 0.36) + t * t * (h * 0.42)];
  if (v.robot || v.chain) return drawSegmented(g, v, pt);
  if (v.glow) { g.shadowColor = typeof v.glow === "string" ? v.glow : "#ffd36b"; g.shadowBlur = 10; }
  g.strokeStyle = v.fiber ? "rgba(232,247,255,0.4)" : v.rope;
  if (v.holo) g.globalAlpha = 0.7;
  const strands = v.strands || 1;
  for (let k = 0; k < strands; k++) {
    const side = strands > 1 ? (k - (strands - 1) / 2) / ((strands - 1) / 2) : 0;
    let [px, py] = pt(0);
    for (let i = 1; i <= N; i++) {
      const t = i / N, [x, y0] = pt(t), y = y0 + side * t * t * 12;
      g.lineWidth = strands > 1 ? 1.2 : v.w0 + (v.w1 - v.w0) * t;
      g.lineCap = v.flat ? "butt" : "round";
      g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
      px = x; py = y;
    }
  }
  g.shadowBlur = 0; g.globalAlpha = 1;
  const [tx, ty] = pt(1);
  if (v.chrome) { g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i <= N; i++) { const [x, y] = pt(i / N); i ? g.lineTo(x, y - 1.5) : g.moveTo(x, y - 1.5); } g.stroke(); }
  if (v.holo) { g.globalCompositeOperation = "lighter"; g.strokeStyle = "rgba(255,79,216,0.45)"; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= N; i++) { const [x, y] = pt(i / N); i ? g.lineTo(x + 3, y) : g.moveTo(x + 3, y); } g.stroke(); g.globalCompositeOperation = "source-over"; }
  if (v.fiber) { for (let k = 0; k < 6; k++) { const [x, y] = pt((k + 0.5) / 6); g.fillStyle = `hsl(${k * 60},100%,65%)`; g.shadowColor = g.fillStyle; g.shadowBlur = 8; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); } g.shadowBlur = 0; }
  if (v.arcs) { g.strokeStyle = v.arcs; g.shadowColor = v.arcs; g.shadowBlur = 6; g.lineWidth = 1; g.beginPath(); const [ax, ay] = pt(0.35), [bx, by] = pt(0.55); g.moveTo(ax, ay); for (let m = 1; m < 5; m++) g.lineTo(ax + (bx - ax) * m / 5 + (m % 2 ? 6 : -6), ay + (by - ay) * m / 5 - 4); g.lineTo(bx, by); g.stroke(); g.shadowBlur = 0; }
  if (v.void) { g.save(); g.translate(tx, ty); g.shadowColor = v.glow; g.shadowBlur = 10; g.strokeStyle = v.glow; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 9, 3.5, -0.4, 0, 7); g.stroke(); g.shadowBlur = 0; g.fillStyle = "#000"; g.beginPath(); g.arc(0, 0, 3.2, 0, 7); g.fill(); g.restore(); }
  if (v.plug) { g.fillStyle = "#e9e9e6"; g.fillRect(tx - 2, ty - 4, 10, 8); g.fillStyle = "#a9a9a6"; g.fillRect(tx + 8, ty - 2, 4, 4); }
  if (v.buckle) { g.strokeStyle = "#c9a54a"; g.lineWidth = 2; g.strokeRect(tx - 4, ty - 7, 11, 14); }
}

// rantai & robot: digambar per ruas biar keliatan bentuknya
function drawSegmented(g, v, pt) {
  const K = v.robot ? 6 : 16, pts = [];
  for (let i = 0; i <= K; i++) pts.push(pt(i / K));
  for (let i = 0; i < K; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    if (v.robot) {
      g.strokeStyle = "#1c2026"; g.lineWidth = 9; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      g.strokeStyle = v.rope; g.lineWidth = 6; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    } else {
      g.save(); g.translate((ax + bx) / 2, (ay + by) / 2); g.rotate(Math.atan2(by - ay, bx - ax));
      g.strokeStyle = v.rope; g.fillStyle = v.rope; g.lineWidth = 1.6; g.beginPath();
      i % 2 ? (g.ellipse(0, 0, Math.hypot(bx - ax, by - ay) * 0.62, 3.2, 0, 0, 7), g.stroke()) : (g.ellipse(0, 0, Math.hypot(bx - ax, by - ay) * 0.62, 1.2, 0, 0, 7), g.fill());
      g.restore();
    }
  }
  for (const [x, y] of pts) {
    if (v.robot) { g.fillStyle = "#2a2f37"; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); g.fillStyle = "#c9d1da"; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); }
    else { g.fillStyle = v.chain; g.shadowColor = v.chain; g.shadowBlur = 6; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); g.shadowBlur = 0; }
  }
}
