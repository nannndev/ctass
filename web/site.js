// Landing page: demo pakai mesin yang sama persis dengan app desktop (disalin ke /engine waktu build).
import { VARIANTS } from "/engine/variants.js";
import { Sound } from "/engine/audio.js";
import { createStage } from "/engine/stage.js";

const $ = (id) => document.getElementById(id);
const sound = new Sound();
const demo = document.querySelector(".demo");

const BLURB = {
  jaranan: "Pecut kuda lumping, lengkap sama rumbainya.",
  sapi: "Pendek dan berat. Gampang bunyi.",
  bullwhip: "Paling panjang, paling susah. Paling puas juga.",
  samandiman: "Versi sakti. Ada percikannya.",
  cemeti: "Tipis, kaku, bunyinya nyaring.",
};

let bubbleTimer = 0;
const stage = createStage({
  canvas: $("stage"),
  sound,
  aiScale: 0.2,
  onFirstMove: () => { $("hint").style.opacity = "0"; },
  onScore: (s) => {
    $("sCrack").textContent = s.crack;
    $("sHit").textContent = s.hit;
    $("sBest").textContent = s.best.toFixed(1);
  },
  onMach: (mach, shown) => {
    $("sMach").textContent = "Mach " + mach.toFixed(2);
    $("machBar").style.width = Math.min(100, (shown / 1.5) * 100) + "%";
  },
  onSay: (text, x, y) => {
    const b = $("bubble");
    b.textContent = text; b.classList.add("on");
    b.style.left = Math.min(demo.clientWidth - 120, Math.max(120, x)) + "px";
    b.style.top = y + "px";
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => b.classList.remove("on"), 1800);
  },
});
addEventListener("resize", () => stage.resize());

// ---------- Pilihan varian (chip di demo + kartu) ----------
const chips = $("variants"), cards = $("cards");
Object.entries(VARIANTS).forEach(([k, v]) => {
  const b = document.createElement("button");
  b.className = "chip"; b.dataset.k = k; b.textContent = v.name;
  b.onclick = () => { sound.init(); pick(k); };
  chips.appendChild(b);

  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <canvas aria-hidden="true"></canvas>
    <h3>${v.name}</h3>
    <p>${BLURB[k] ?? ""}</p>
    <button class="chip" data-k="${k}">Coba</button>`;
  card.querySelector("button").onclick = () => {
    sound.init(); pick(k);
    demo.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  };
  cards.appendChild(card);
  drawSwatch(card.querySelector("canvas"), v);
});
function pick(k) {
  stage.pick(k);
  document.querySelectorAll(".chip[data-k]").forEach((c) => {
    if (c.closest(".chips")) c.setAttribute("aria-pressed", String(c.dataset.k === k));
  });
}
$("sound").onclick = () => {
  sound.init(); sound.on = !sound.on;
  $("sound").textContent = "Suara " + (sound.on ? "on" : "off");
  $("sound").setAttribute("aria-pressed", String(sound.on));
};
addEventListener("keydown", (e) => {
  const keys = Object.keys(VARIANTS), n = Number(e.key);
  if (n >= 1 && n <= keys.length && !e.metaKey && !e.ctrlKey) pick(keys[n - 1]);
});
pick("jaranan");

// gambar kecil tiap pecut di kartu: gagang + tali melengkung, warnanya sesuai varian
function drawSwatch(c, v) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = c.clientWidth || 220, h = c.clientHeight || 74;
  c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext("2d"); g.scale(dpr, dpr); g.lineCap = "round";
  const hx = 14, hy = h - 14, ex = 14 + v.handle * 150, ey = h - 14 - v.handle * 90;
  g.strokeStyle = v.grip; g.lineWidth = 9; g.beginPath(); g.moveTo(hx, hy); g.lineTo(ex, ey); g.stroke();
  const len = (w - ex - 10) * Math.min(1, v.len / 0.78), N = 40;
  if (v.glow) { g.shadowColor = "#ffd36b"; g.shadowBlur = 10; }
  g.strokeStyle = v.rope;
  let px = ex, py = ey;
  for (let i = 1; i <= N; i++) {
    const t = i / N, x = ex + t * len, y = ey - Math.sin(t * Math.PI) * 26 + t * t * 30;
    g.lineWidth = v.w0 + (v.w1 - v.w0) * t;
    g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
    px = x; py = y;
  }
}

// ---------- Contoh omelan, diketik ulang waktu kelihatan ----------
const typed = $("typed");
const NAG = "[Ctas] Kamu barusan dipecut 7 kali, 2 kali kena muka. Cepetan dong, jangan halu, langsung kerjain.";
typed.textContent = NAG; // lengkap dulu biar kebaca tanpa animasi
if (!matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  let done = false;
  new IntersectionObserver((entries, obs) => {
    if (done || !entries[0].isIntersecting) return;
    done = true; obs.disconnect();
    let i = 0;
    typed.textContent = "";
    const t = setInterval(() => { typed.textContent = NAG.slice(0, ++i); if (i >= NAG.length) clearInterval(t); }, 28);
  }, { threshold: 0.6 }).observe(typed);
}
