// Jendela Ctas: pilih pecut, custom, nyobain, terus mulai.
import { VARIANTS } from "./variants.js";
import { Sound } from "./audio.js";
import { createStage } from "./stage.js";
import { drawSwatch } from "./swatch.js";
import { RANGES, normalize, effective } from "./settings.js";
import { whipName } from "./i18n.js";

const TAURI = window.__TAURI__;
const IS_MAC = /Mac/i.test(navigator.userAgent);
const IS_LINUX = /Linux/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent);
const $ = (id) => document.getElementById(id);
const KEYS = Object.keys(VARIANTS);
const KEY = IS_MAC ? "⌘⇧X" : "Ctrl+Alt+X";
const sound = new Sound();
let settings = normalize({});

const STR = {
  id: {
    tagline: "pecut virtual", start: "Mulai mecut", whips: "Pecut", customize: "Atur", reset: "Balikin default",
    length: "Panjang", stiffness: "Kekakuan", weight: "Berat", rope: "Tali", handle: "Gagang",
    sound: "Suara", effect: "Efek", word: "Tulisan pas ctarr",
    showWord: "Tampilkan tulisan pas ctarr", showWordSub: "Matiin kalau mau efeknya aja tanpa tulisan.",
    general: "Umum",
    tipKeys: "Tips: tekan 1–9 buat ganti pecut. Coba langsung di preview atas.",
    groupMode: "Cara mecut", groupView: "Tampilan", groupFeel: "Rasa", groupNag: "Omelan", about: "Tentang",
    checkUpdate: "Cek update", checking: "Lagi ngecek…", upToDate: "Udah versi terbaru.", updateFail: "Gagal ngecek update. Coba lagi nanti.",
    newVersion: (v) => `Versi baru <b>v${v}</b> udah ada.`, updateNow: "Update sekarang", updating: "Lagi download…", restarting: "Bentar, Ctas dibuka ulang…",
    webVersion: "versi web",
    view2d: "2D", view2dSub: "Paling ringan. Semua pecut.", view3d: "3D", view3dSub: "Baru ada buat Bullwhip. Sedikit lebih berat.", view3dFail: "3D nggak didukung di komputer ini, balik ke 2D.",
    modeFollow: "Ikut kursor", modeFollowSub: "Pecut nempel di kursor. Sentak mouse buat ctarr.",
    modeClick: "Klik = pecut", modeClickSub: "Pecut nongkrong di pojok. Tiap klik, dia nyabet titik itu. Seret gagangnya buat mindahin.",
    linuxNote: "Di Linux, mode klik baru jalan di preview ini, belum di overlay.",
    easy: "Gampang bunyi", volume: "Volume",
    nag: "Ketik omelan ke AI pas udahan", nagSub: "Omelan diketik ke jendela yang lagi aktif.", nagMac: " Di Mac, bakal minta izin Accessibility sekali.",
    autosend: "Langsung kirim", autosendSub: "Sekalian tekan Enter abis ngetik omelan.",
    stiff: "kaku", medium: "sedang", loose: "lentur", cracks: "ctarr",
    hintFollow: "Coba ayun di sini, terus sentak.", hintClick: "Klik di sini buat nyabet. Seret gagangnya buat mindahin.",
    foot: (tray) => `Jendela ini boleh ditutup, Ctas tetap jalan di ${tray}. Mulai / udahan kapan aja pakai <b>${KEY}</b>.`,
    tray: IS_MAC ? "menu bar" : "system tray",
  },
  en: {
    tagline: "a virtual whip", start: "Start whipping", whips: "Whips", customize: "Customize", reset: "Reset to default",
    length: "Length", stiffness: "Stiffness", weight: "Weight", rope: "Rope", handle: "Handle",
    sound: "Sound", effect: "Effect", word: "Word on crack",
    showWord: "Show the word on crack", showWordSub: "Turn off if you only want the effect, no text.",
    general: "General",
    tipKeys: "Tip: press 1–9 to switch whips. Try it right in the preview above.",
    groupMode: "How to whip", groupView: "Look", groupFeel: "Feel", groupNag: "Scolding", about: "About",
    checkUpdate: "Check for updates", checking: "Checking…", upToDate: "You're on the latest version.", updateFail: "Couldn't check for updates. Try again later.",
    newVersion: (v) => `Version <b>v${v}</b> is out.`, updateNow: "Update now", updating: "Downloading…", restarting: "Hang on, restarting Ctas…",
    webVersion: "web version",
    view2d: "2D", view2dSub: "Lightest. Every whip.", view3d: "3D", view3dSub: "Bullwhip only for now. A bit heavier.", view3dFail: "3D isn't supported on this computer, back to 2D.",
    modeFollow: "Follow cursor", modeFollowSub: "The whip sticks to your cursor. Flick the mouse to crack.",
    modeClick: "Click = whip", modeClickSub: "The whip waits in a corner. Every click, it lashes that spot. Drag its handle to move it.",
    linuxNote: "On Linux, click mode only works in this preview for now, not the overlay.",
    easy: "Easy to crack", volume: "Volume",
    nag: "Type a scolding into the AI when done", nagSub: "It's typed into whatever window is active.", nagMac: " On Mac, it asks for Accessibility permission once.",
    autosend: "Send right away", autosendSub: "Also press Enter after typing it.",
    stiff: "stiff", medium: "medium", loose: "loose", cracks: "cracks",
    hintFollow: "Swing here, then flick.", hintClick: "Click here to whip. Drag its handle to move it.",
    foot: (tray) => `You can close this window, Ctas keeps running in the ${tray}. Start / stop anytime with <b>${KEY}</b>.`,
    tray: IS_MAC ? "menu bar" : "system tray",
  },
};
const S = () => STR[settings.lang] || STR.id;

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
  onScore: () => { count++; $("count").textContent = count + " " + S().cracks; },
  onMach: (mach, shown) => { $("bar").style.width = Math.min(100, (shown / 1.5) * 100) + "%"; },
  // preview = layar mini: posisi pecut di sini kepake juga di overlay
  onHomeChange: (h) => { settings.home = h; save(); },
});
$("stage").addEventListener("pointerdown", () => sound.init());
addEventListener("resize", () => stage.resize());

// ---------- Kontrol ----------
const custom = () => (settings.custom[settings.variant] ||= {});
const base = () => VARIANTS[settings.variant];
const name = (k) => whipName(k, VARIANTS[k], settings.lang);

function setRange(id, [min, max, step], value) {
  const el = $(id); el.min = min; el.max = max; el.step = step; el.value = value;
}
const pct = (x) => Math.round(x * 100) + "%";

function texts() {
  const T = S();
  document.documentElement.lang = settings.lang;
  document.querySelectorAll("[data-t]").forEach((el) => (el.textContent = typeof T[el.dataset.t] === "string" ? T[el.dataset.t] : ""));
  document.querySelectorAll(".lang").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.lang === settings.lang)));
  document.querySelectorAll(".tile").forEach((t) => (t.querySelector(".nm").textContent = name(t.dataset.k)));
  for (const id of ["sound", "fx"]) [...$(id).options].forEach((o) => (o.textContent = name(o.value)));
  $("foot").innerHTML = T.foot(T.tray);
  $("count").textContent = count + " " + T.cracks;
  if (!TAURI) $("version").textContent = T.webVersion;
  updateTexts();
}

function render() {
  const k = settings.variant, b = base(), c = custom(), T = S();
  texts();
  document.querySelectorAll(".tile").forEach((t) => t.setAttribute("aria-checked", String(t.dataset.k === k)));
  $("curName").textContent = name(k);
  setRange("len", RANGES.len, c.len ?? 1); $("oLen").textContent = pct(c.len ?? 1);
  const bend = c.bend ?? b.bend;
  setRange("bend", RANGES.bend, bend); $("oBend").textContent = bend > 0.2 ? T.stiff : bend > 0.1 ? T.medium : T.loose;
  setRange("grav", RANGES.grav, c.grav ?? 1); $("oGrav").textContent = pct(c.grav ?? 1);
  $("rope").value = c.rope ?? b.rope; $("oRope").textContent = $("rope").value;
  $("grip").value = c.grip ?? b.grip; $("oGrip").textContent = $("grip").value;
  $("sound").value = c.sound ?? k;
  $("fx").value = c.fx ?? k;
  $("word").value = c.word ?? "";
  $("word").placeholder = VARIANTS[c.fx ?? k].word;
  $("showWord").checked = settings.showWord;
  // gampang bunyi = kebalikan sensitivitas (batas Mach 1 lebih rendah)
  setRange("sensitivity", RANGES.sensitivity, 2 - settings.sensitivity);
  $("oSens").textContent = pct(2 - settings.sensitivity);
  setRange("volume", RANGES.volume, settings.volume); $("oVol").textContent = pct(settings.volume);
  document.querySelectorAll('input[name="mode"]').forEach((r) => (r.checked = r.value === settings.mode));
  document.querySelectorAll('input[name="view"]').forEach((r) => (r.checked = r.value === settings.view));
  $("viewSub").textContent = settings.view === "3d" ? T.view3dSub : T.view2dSub;
  $("hint").textContent = settings.mode === "click" ? T.hintClick : T.hintFollow;
  $("clickNote").hidden = !(IS_LINUX && TAURI && settings.mode === "click");
  $("nag").checked = settings.nag;
  $("autosend").checked = settings.autosend;
  apply();
}

function apply() {
  stage.use(effective(settings), settings.variant);
  stage.setShowWord(settings.showWord);
  if (settings.home) stage.setHome(settings.home);
  if (stage.mode !== settings.mode) stage.setMode(settings.mode);
  if (stage.is3D !== (settings.view === "3d")) {
    stage.set3D(settings.view === "3d").then((ok) => {
      if (settings.view === "3d" && !ok) { settings.view = "2d"; $("viewNote").hidden = false; changed(); }
    });
  }
  sound.setVolume(settings.volume);
}

function changed() { render(); save(); }

// pecut
KEYS.forEach((k, i) => {
  const t = document.createElement("button");
  t.type = "button"; t.className = "tile"; t.dataset.k = k; t.setAttribute("role", "radio");
  t.innerHTML = `<canvas aria-hidden="true"></canvas><span class="nm"></span><span class="num">${i + 1}${VARIANTS[k].d3 ? ' <b class="badge">3D</b>' : ""}</span>`;
  t.onclick = () => { sound.init(); settings.variant = k; changed(); };
  $("tiles").appendChild(t);
  requestAnimationFrame(() => drawSwatch(t.querySelector("canvas"), VARIANTS[k]));
});
for (const id of ["sound", "fx"]) {
  KEYS.forEach((k) => { const o = document.createElement("option"); o.value = k; $(id).appendChild(o); });
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
$("showWord").addEventListener("change", (e) => { settings.showWord = e.target.checked; changed(); });

// umum
$("sensitivity").addEventListener("input", (e) => { settings.sensitivity = +(2 - e.target.value).toFixed(2); changed(); });
$("volume").addEventListener("input", (e) => { settings.volume = +e.target.value; sound.init(); changed(); });
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => {
  settings.mode = r.value; $("hint").style.opacity = "1"; changed();
}));
document.querySelectorAll('input[name="view"]').forEach((r) => r.addEventListener("change", () => {
  settings.view = r.value;
  // 3D baru ada buat sebagian pecut: langsung pindah ke situ biar kelihatan bedanya
  if (r.value === "3d" && !VARIANTS[settings.variant].d3) settings.variant = KEYS.find((k) => VARIANTS[k].d3);
  changed();
}));
$("nag").addEventListener("change", (e) => { settings.nag = e.target.checked; changed(); });
$("autosend").addEventListener("change", (e) => { settings.autosend = e.target.checked; changed(); });
document.querySelectorAll(".lang").forEach((b) => (b.onclick = () => { settings.lang = b.dataset.lang; changed(); }));

// ---------- Tab ----------
let tab = "whips";
try { tab = localStorage.getItem("ctas.tab") || tab; } catch {}
function showTab(t) {
  tab = t;
  document.querySelectorAll(".tabs [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
  document.querySelectorAll(".pane").forEach((p) => (p.hidden = p.dataset.pane !== t));
  try { localStorage.setItem("ctas.tab", t); } catch {}
}
document.querySelectorAll(".tabs [data-tab]").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
showTab(tab);

// ---------- Update ----------
// state: idle | checking | latest | fail | found | downloading | restarting
const upd = { state: "idle", version: null, done: 0, total: 0 };
function updateTexts() {
  const T = S();
  $("updStatus").textContent = { checking: T.checking, latest: T.upToDate, fail: T.updateFail }[upd.state] || "";
  $("checkUpd").disabled = upd.state === "checking" || upd.state === "downloading" || upd.state === "restarting";
  const show = ["found", "downloading", "restarting"].includes(upd.state);
  $("update").hidden = !show;
  if (!show) return;
  $("updText").innerHTML = upd.state === "found" ? T.newVersion(upd.version) : upd.state === "downloading" ? T.updating : T.restarting;
  $("updBtn").hidden = upd.state !== "found";
  $("upbar").hidden = upd.state === "found";
  $("updBar").style.width = upd.total ? Math.round((upd.done / upd.total) * 100) + "%" : upd.state === "restarting" ? "100%" : "8%";
}
async function checkUpdate(quiet) {
  if (!TAURI) return;
  upd.state = "checking"; if (!quiet) updateTexts();
  try {
    upd.version = await TAURI.core.invoke("check_update");
    upd.state = upd.version ? "found" : quiet ? "idle" : "latest";
  } catch (e) {
    console.warn("cek update gagal", e);
    upd.state = quiet ? "idle" : "fail";
  }
  updateTexts();
}
$("checkUpd").onclick = () => checkUpdate(false);
$("updBtn").onclick = async () => {
  upd.state = "downloading"; updateTexts();
  try {
    await TAURI.core.invoke("install_update"); // kalau sukses, app langsung dibuka ulang
    upd.state = "restarting";
  } catch (e) {
    console.warn("update gagal", e);
    upd.state = "fail";
  }
  updateTexts();
};
if (TAURI) {
  TAURI.event.listen("ctas://update-progress", (e) => {
    const [done, total] = e.payload;
    upd.done = done; upd.total = total || 0;
    if (total && done >= total) upd.state = "restarting";
    updateTexts();
  });
  TAURI.app.getVersion().then((v) => ($("version").textContent = "v" + v)).catch(() => {});
  setTimeout(() => checkUpdate(true), 2500); // cek diem-diem pas dibuka
} else {
  $("checkUpd").hidden = true;
}

// keyboard 1-9 buat ganti pecut
addEventListener("keydown", (e) => {
  if (e.target.matches("input[type=text]")) return;
  const n = Number(e.key);
  if (n >= 1 && n <= KEYS.length) { settings.variant = KEYS[n - 1]; changed(); }
});

// mulai
$("key").textContent = KEY;
document.querySelectorAll(".mac-only").forEach((el) => (el.hidden = !IS_MAC));
$("start").onclick = () => {
  clearTimeout(saveTimer);
  if (TAURI) TAURI.core.invoke("save_settings", { settings }).then(() => TAURI.core.invoke("start"));
};
if (!TAURI) $("start").hidden = true;

settings = await load();
render();
save(); // simpan sekali biar Rust juga tau bahasa default-nya
