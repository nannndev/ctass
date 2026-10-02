// Jendela Ctas: pilih pecut, custom, nyobain, terus mulai.
import { VARIANTS } from "./variants.js";
import { Sound } from "./audio.js";
import { createStage } from "./stage.js";
import { drawSwatch } from "./swatch.js";
import { RANGES, normalize, effective } from "./settings.js";

const TAURI = window.__TAURI__;
const IS_MAC = /Mac/i.test(navigator.userAgent);
const $ = (id) => document.getElementById(id);
const KEYS = Object.keys(VARIANTS);
const sound = new Sound();
let settings = normalize({});

// ---------- Simpan / muat ----------
async function load() {
  try {
    if (TAURI) return normalize(await TAURI.core.invoke("get_settings"));
    return normalize(JSON.parse(localStorage.getItem("ctas.settings") || "{}"));
  } catch { return normalize({}); }
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (TAURI) TAURI.core.invoke("save_settings", { settings }).catch(console.error);
    else try { localStorage.setItem("ctas.settings", JSON.stringify(settings)); } catch {}
  }, 200);
}

// ---------- Preview ----------
let count = 0;
const stage = createStage({
  canvas: $("stage"),
  sound,
  onFirstMove: () => { $("hint").style.opacity = "0"; },
  onScore: () => { $("count").textContent = ++count + " ctarr"; },
  onMach: (mach, shown) => { $("bar").style.width = Math.min(100, (shown / 1.5) * 100) + "%"; },
});
$("stage").addEventListener("pointerdown", () => sound.init());
addEventListener("resize", () => stage.resize());

// ---------- Kontrol ----------
const custom = () => (settings.custom[settings.variant] ||= {});
const base = () => VARIANTS[settings.variant];

function setRange(id, [min, max, step], value) {
  const el = $(id); el.min = min; el.max = max; el.step = step; el.value = value;
}
const pct = (x) => Math.round(x * 100) + "%";

function render() {
  const k = settings.variant, b = base(), c = custom();
  document.querySelectorAll(".tile").forEach((t) => t.setAttribute("aria-checked", String(t.dataset.k === k)));
  $("curName").textContent = b.name;
  setRange("len", RANGES.len, c.len ?? 1); $("oLen").textContent = pct(c.len ?? 1);
  const bend = c.bend ?? b.bend;
  setRange("bend", RANGES.bend, bend); $("oBend").textContent = bend > 0.2 ? "kaku" : bend > 0.1 ? "sedang" : "lentur";
  setRange("grav", RANGES.grav, c.grav ?? 1); $("oGrav").textContent = pct(c.grav ?? 1);
  $("rope").value = c.rope ?? b.rope;
  $("grip").value = c.grip ?? b.grip;
  $("sound").value = c.sound ?? k;
  $("fx").value = c.fx ?? k;
  $("word").value = c.word ?? "";
  $("word").placeholder = VARIANTS[c.fx ?? k].word;
  // gampang bunyi = kebalikan sensitivitas (batas Mach 1 lebih rendah)
  setRange("sensitivity", RANGES.sensitivity, 2 - settings.sensitivity);
  $("oSens").textContent = pct(2 - settings.sensitivity);
  setRange("volume", RANGES.volume, settings.volume); $("oVol").textContent = pct(settings.volume);
  document.querySelectorAll('input[name="mode"]').forEach((r) => (r.checked = r.value === settings.mode));
  $("hint").textContent = settings.mode === "click" ? "Klik di sini buat nyabet. Double klik = dua kali." : "Coba ayun di sini, terus sentak.";
  $("nag").checked = settings.nag;
  $("autosend").checked = settings.autosend;
  apply();
}

function apply() {
  stage.use(effective(settings), settings.variant);
  if (stage.mode !== settings.mode) stage.setMode(settings.mode);
  sound.setVolume(settings.volume);
}

function changed() { render(); save(); }

// pecut
KEYS.forEach((k, i) => {
  const v = VARIANTS[k];
  const t = document.createElement("button");
  t.type = "button"; t.className = "tile"; t.dataset.k = k; t.setAttribute("role", "radio");
  t.innerHTML = `<canvas aria-hidden="true"></canvas><span>${v.name}</span><span class="num">${i + 1}</span>`;
  t.onclick = () => { sound.init(); settings.variant = k; changed(); };
  $("tiles").appendChild(t);
  requestAnimationFrame(() => drawSwatch(t.querySelector("canvas"), v));
});
for (const id of ["sound", "fx"]) {
  KEYS.forEach((k) => { const o = document.createElement("option"); o.value = k; o.textContent = VARIANTS[k].name; $(id).appendChild(o); });
}

// custom pecut yang lagi dipilih
const bindCustom = (id, parse = Number) => $(id).addEventListener("input", (e) => {
  const val = parse(e.target.value);
  if (val === "" || val == null) delete custom()[id]; else custom()[id] = val;
  changed();
});
bindCustom("len"); bindCustom("bend"); bindCustom("grav");
bindCustom("rope", String); bindCustom("grip", String);
bindCustom("sound", String); bindCustom("fx", String);
bindCustom("word", (s) => s.trim());
$("resetOne").onclick = () => { delete settings.custom[settings.variant]; changed(); };

// umum
$("sensitivity").addEventListener("input", (e) => { settings.sensitivity = +(2 - e.target.value).toFixed(2); changed(); });
$("volume").addEventListener("input", (e) => { settings.volume = +e.target.value; sound.init(); changed(); });
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => {
  settings.mode = r.value; $("hint").style.opacity = "1"; changed();
}));
$("clickNote").hidden = !/Linux/i.test(navigator.userAgent) || !TAURI;
$("nag").addEventListener("change", (e) => { settings.nag = e.target.checked; changed(); });
$("autosend").addEventListener("change", (e) => { settings.autosend = e.target.checked; changed(); });

// keyboard 1-9 buat ganti pecut
addEventListener("keydown", (e) => {
  if (e.target.matches("input[type=text]")) return;
  const n = Number(e.key);
  if (n >= 1 && n <= KEYS.length) { settings.variant = KEYS[n - 1]; changed(); }
});

// mulai
const key = IS_MAC ? "⌘⇧X" : "Ctrl+Alt+X";
$("key").textContent = key; $("key2").textContent = key;
$("trayWord").textContent = IS_MAC ? "menu bar" : "system tray";
document.querySelectorAll(".mac-only").forEach((el) => (el.hidden = !IS_MAC));
$("start").onclick = () => {
  clearTimeout(saveTimer);
  if (TAURI) TAURI.core.invoke("save_settings", { settings }).then(() => TAURI.core.invoke("start"));
};
if (!TAURI) $("start").hidden = true;

settings = await load();
render();
