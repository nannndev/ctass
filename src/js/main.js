import { VARIANTS } from "./variants.js";
import { Sound } from "./audio.js";
import { createStage } from "./stage.js";
import { normalize, effective } from "./settings.js";
import { t, whipName } from "./i18n.js";
import { ensureSound as loadCustomSound } from "./sounds.js";

const TAURI = window.__TAURI__;
const IS_MAC = /Mac/i.test(navigator.userAgent);
const OVERLAY = !!TAURI; // di app desktop: jendela transparan di atas layar
document.body.classList.toggle("overlay", OVERLAY);

const $ = (id) => document.getElementById(id);
const sound = new Sound();

let bubbleTimer = 0;
const stage = createStage({
  canvas: $("stage"),
  sound,
  transparent: OVERLAY,
  cursorDot: !OVERLAY,    // di overlay pakai kursor sistem
  size: OVERLAY ? 0.75 : 1,
  onFirstMove: () => { $("hint").style.opacity = "0"; },
  onHomeChange: (h) => {
    settings.home = h;
    if (OVERLAY) TAURI.core.invoke("save_settings", { settings }).catch(console.error);
    else try { localStorage.setItem("ctas.settings", JSON.stringify(settings)); } catch {}
  },
  onScore: (s) => {
    $("pillCount").textContent = stage.session.crack + " " + t("ctarr", settings.lang);
    $("sCrack").textContent = s.crack;
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
let settings = normalize({});
function applySettings(s) {
  settings = normalize(s);
  const v = effective(settings);
  stage.use(v, settings.variant);
  stage.setShowWord(settings.showWord);
  if (settings.home) stage.setHome(settings.home);
  if (stage.mode !== settings.mode) stage.setMode(settings.mode);
  if (stage.is3D !== (settings.view === "3d")) stage.set3D(settings.view === "3d");
  stage.setTheme(settings.theme);
  document.documentElement.dataset.theme = settings.theme;
  loadCustomSound(sound, v.sound);
  sound.setVolume(settings.volume);
  const L = settings.lang;
  document.documentElement.lang = L;
  $("pillName").textContent = whipName(settings.variant, v, L);
  $("pillMode").textContent = t(settings.mode === "click" ? "modeClick" : "modeFollow", L);
  $("pillKey").textContent = (IS_MAC ? "⌘⇧X " : "Ctrl+Alt+X ") + t("stop", L);
  $("pillCount").textContent = stage.session.crack + " " + t("ctarr", L);
  $("unlock").textContent = t("clickToSound", L);
}
function pick(k) {
  applySettings({ ...settings, variant: k });
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
  const keys = Object.keys(VARIANTS), i = (Number(e.key) + 9) % 10;
  if (/^[0-9]$/.test(e.key) && i < keys.length) pick(keys[i]);
});
addEventListener("resize", () => stage.resize());

// ---------- Jembatan ke app desktop ----------

let pillTimer = 0;
function flashPill(ms = 2600) {
  $("pill").classList.remove("fade");
  clearTimeout(pillTimer); pillTimer = setTimeout(() => $("pill").classList.add("fade"), ms);
}
function dismiss() {
  if (!OVERLAY) return;
  const { crack, hit } = stage.session;
  TAURI.core.invoke("dismiss", { cracks: crack, hits: hit }).catch(console.error);
  stage.session.crack = stage.session.hit = 0;
}
// WebView desktop biasanya boleh muter suara tanpa klik. Kalau ternyata nggak,
// matiin tembus klik sebentar dan minta satu klik.
function ensureSound() {
  sound.init();
  setTimeout(() => {
    if (!sound.ac || sound.ac.state === "running") return;
    $("unlock").hidden = false;
    TAURI.core.invoke("set_passthrough", { on: false });
  }, 400);
}
if (OVERLAY) {
  $("stage").addEventListener("pointerdown", () => {
    if ($("unlock").hidden) return;
    sound.init();
    sound.ac?.resume().finally(() => {
      $("unlock").hidden = true;
      TAURI.core.invoke("set_passthrough", { on: true });
    });
  });
  TAURI.event.listen("ctas://activated", () => {
    stage.session.crack = stage.session.hit = 0;
    $("pillCount").textContent = "0 " + t("ctarr", settings.lang);
    stage.rearm();
    flashPill();
    ensureSound();
  });
  TAURI.event.listen("ctas://cursor", (e) => stage.pointer(e.payload[0], e.payload[1]));
  TAURI.event.listen("ctas://settings", (e) => applySettings(e.payload));
  // mode klik: tekan = nyabet (atau mulai geser kalau kena gagang), lepas = selesai geser
  TAURI.event.listen("ctas://click", (e) => {
    if (settings.mode !== "click") return;
    const [x, y, n] = e.payload;
    sound.init(); stage.pressAt(x, y, n);
  });
  TAURI.event.listen("ctas://release", () => stage.releaseAt());
  TAURI.event.listen("ctas://request-dismiss", dismiss);
}

// ---------- Mulai ----------
// app desktop: pengaturan dari jendela Ctas (disimpan Rust). Browser: localStorage.
if (OVERLAY) {
  applySettings(await TAURI.core.invoke("get_settings").catch(() => ({})));
} else {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("ctas.settings") || "{}"); } catch {}
  try { const k = localStorage.getItem("ctas.variant"); if (k && VARIANTS[k]) saved.variant = k; } catch {}
  applySettings(saved);
}
pick(settings.variant);
window.__ctas = { stage, get score() { return stage.score; } };
