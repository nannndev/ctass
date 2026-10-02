import { VARIANTS } from "./variants.js";
import { Sound } from "./audio.js";
import { createStage } from "./stage.js";

const TAURI = window.__TAURI__;
const OVERLAY = !!TAURI; // di app desktop: jendela transparan di atas layar
document.body.classList.toggle("overlay", OVERLAY);

const $ = (id) => document.getElementById(id);
const sound = new Sound();

let bubbleTimer = 0;
const stage = createStage({
  canvas: $("stage"),
  sound,
  transparent: OVERLAY,
  aiScale: OVERLAY ? 0.12 : 0.17,
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
    b.style.left = Math.min(innerWidth - 120, Math.max(120, x)) + "px";
    b.style.top = y + "px";
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => b.classList.remove("on"), 1800);
  },
});

// ---------- Varian ----------
const chips = $("variants");
Object.keys(VARIANTS).forEach((k, i) => {
  const b = document.createElement("button");
  b.className = "chip"; b.id = "v-" + k; b.textContent = VARIANTS[k].name;
  b.title = `Tombol ${i + 1}`;
  b.onclick = () => { sound.init(); pick(k); };
  chips.appendChild(b);
});
function pick(k) {
  stage.pick(k);
  chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.id === "v-" + k)));
  try { localStorage.setItem("ctas.variant", k); } catch {}
}

// ---------- Tombol & keyboard ----------
$("sound").onclick = () => {
  sound.init(); sound.on = !sound.on;
  $("sound").textContent = "Suara " + (sound.on ? "on" : "off");
  $("sound").setAttribute("aria-pressed", String(sound.on));
};
$("reset").onclick = () => stage.reset();
$("done").onclick = () => dismiss();
addEventListener("keydown", (e) => {
  sound.init();
  if (e.key === "Escape" && OVERLAY) dismiss();
  const keys = Object.keys(VARIANTS), n = Number(e.key);
  if (n >= 1 && n <= keys.length) pick(keys[n - 1]);
});
addEventListener("resize", () => stage.resize());

// ---------- Jembatan ke app desktop ----------
function dismiss() {
  if (!OVERLAY) return;
  const { crack, hit } = stage.session;
  TAURI.core.invoke("dismiss", { cracks: crack, hits: hit }).catch(console.error);
  stage.session.crack = stage.session.hit = 0;
}
if (OVERLAY) {
  TAURI.event.listen("ctas://activated", () => {
    stage.session.crack = stage.session.hit = 0;
    $("hint").style.opacity = "1";
    stage.rearm();
  });
  TAURI.event.listen("ctas://request-dismiss", dismiss);
}

// ---------- Mulai ----------
let saved = "jaranan";
try { const s = localStorage.getItem("ctas.variant"); if (s && VARIANTS[s]) saved = s; } catch {}
pick(saved);
window.__ctas = { get score() { return stage.score; } };
