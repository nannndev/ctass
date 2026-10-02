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
  if (v.glow) { g.shadowColor = typeof v.glow === "string" ? v.glow : "#ffd36b"; g.shadowBlur = 10; }
  g.strokeStyle = v.rope;
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
  g.shadowBlur = 0;
  const [tx, ty] = pt(1);
  if (v.plug) { g.fillStyle = "#e9e9e6"; g.fillRect(tx - 2, ty - 4, 10, 8); g.fillStyle = "#a9a9a6"; g.fillRect(tx + 8, ty - 2, 4, 4); }
  if (v.buckle) { g.strokeStyle = "#c9a54a"; g.lineWidth = 2; g.strokeRect(tx - 4, ty - 7, 11, 14); }
}
