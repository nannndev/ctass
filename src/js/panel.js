// Jendela Ctas: pilih pecut, custom, nyobain, terus mulai.
import { VARIANTS } from "./variants.js";
import { Sound } from "./audio.js";
import { createStage } from "./stage.js";
import { drawSwatch } from "./swatch.js";
import { RANGES, normalize, effective } from "./settings.js";
import { whipName } from "./i18n.js";
import { saveSound, deleteSound, ensureSound } from "./sounds.js";

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
    tipKeys: "Tips: tekan 1–9 & 0 buat ganti pecut. Coba langsung di preview atas.",
    groupMode: "Cara mecut", groupView: "Tampilan", groupFeel: "Rasa", groupNag: "Omelan", about: "Tentang",
    checkUpdate: "Cek update", checking: "Lagi ngecek…", upToDate: "Udah versi terbaru.", updateFail: "Gagal ngecek update. Coba lagi nanti.",
    newVersion: (v) => `Versi baru <b>v${v}</b> udah ada.`, updateNow: "Update sekarang", updating: "Lagi download…", restarting: "Bentar, Ctas dibuka ulang…",
    webVersion: "versi web",
    testSound: "Tes", soundFile: "Suara sendiri…", replaceFile: "Ganti file", fileGain: "Volume suara",
    echo: "Gema", room: "Ruang (reverb)", pitch: "Nada", off: "mati",
    trimHint: "Seret garis kiri/kanan buat motong awal & akhir. Seret tengahnya buat geser.",
    tooBig: "File kegedean (maks 8 MB). Potong dulu ya.", badFile: "File ini nggak bisa dibaca. Coba mp3 / wav / ogg / m4a.",
    missingFile: "File suaranya udah nggak ada. Pilih lagi ya.",
    themeClassic: "Klasik", themeFuture: "Futuristik",
    view2d: "2D", view2dSub: "Paling ringan. Semua pecut.", view3d: "3D", view3dSub: "Pecutnya jadi 3D beneran. Sedikit lebih berat.", view3dFail: "3D nggak didukung di komputer ini, balik ke 2D.",
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
    tipKeys: "Tip: press 1–9 & 0 to switch whips. Try it right in the preview above.",
    groupMode: "How to whip", groupView: "Look", groupFeel: "Feel", groupNag: "Scolding", about: "About",
    checkUpdate: "Check for updates", checking: "Checking…", upToDate: "You're on the latest version.", updateFail: "Couldn't check for updates. Try again later.",
    newVersion: (v) => `Version <b>v${v}</b> is out.`, updateNow: "Update now", updating: "Downloading…", restarting: "Hang on, restarting Ctas…",
    webVersion: "web version",
    testSound: "Test", soundFile: "Your own sound…", replaceFile: "Replace file", fileGain: "Sound volume",
    echo: "Echo", room: "Room (reverb)", pitch: "Pitch", off: "off",
    trimHint: "Drag the left/right lines to trim the start & end. Drag the middle to move it.",
    tooBig: "That file's too big (max 8 MB). Trim it first.", badFile: "Can't read this file. Try an mp3 / wav / ogg / m4a.",
    missingFile: "That sound file is gone. Pick it again.",
    themeClassic: "Classic", themeFuture: "Futuristic",
    view2d: "2D", view2dSub: "Lightest. Every whip.", view3d: "3D", view3dSub: "Real 3D whips. A bit heavier.", view3dFail: "3D isn't supported on this computer, back to 2D.",
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
  for (const id of ["sound", "fx"]) [...$(id).options].forEach((o) => (o.textContent = o.value === "file" ? T.soundFile : name(o.value)));
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
  $("sound").value = c.sound === "file" && c.file ? "file" : c.sound && c.sound !== "file" ? c.sound : k;
  const rec = (c.sound && VARIANTS[c.sound] ? VARIANTS[c.sound] : b).sound;
  const echo = c.echo ?? rec.echo?.[2] ?? 0, room = c.room ?? rec.wet, pitch = c.pitch ?? 1;
  setRange("echo", RANGES.echo, echo); $("oEcho").textContent = echo > 0 ? pct(echo / RANGES.echo[1]) : T.off;
  setRange("room", RANGES.room, room); $("oRoom").textContent = room > 0 ? pct(room / RANGES.room[1]) : T.off;
  setRange("pitch", RANGES.pitch, pitch); $("oPitch").textContent = "×" + pitch.toFixed(2);
  renderEditor();
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
  document.querySelectorAll('input[name="theme"]').forEach((r) => (r.checked = r.value === settings.theme));
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
  document.documentElement.dataset.theme = settings.theme;
  stage.setTheme(settings.theme);
  ensureSound(sound, effective(settings).sound).then((ok) => { if (!ok) fileNote("missingFile"); drawWave(); });
}

function changed() { render(); save(); }

// pecut
KEYS.forEach((k, i) => {
  const t = document.createElement("button");
  t.type = "button"; t.className = "tile"; t.dataset.k = k; t.setAttribute("role", "radio");
  t.innerHTML = `<canvas aria-hidden="true"></canvas><span class="nm"></span><span class="num">${(i + 1) % 10}</span>`;
  t.onclick = () => { sound.init(); settings.variant = k; changed(); };
  $("tiles").appendChild(t);
  requestAnimationFrame(() => drawSwatch(t.querySelector("canvas"), VARIANTS[k]));
});
for (const id of ["sound", "fx"]) {
  KEYS.forEach((k) => { const o = document.createElement("option"); o.value = k; $(id).appendChild(o); });
}
{ const o = document.createElement("option"); o.value = "file"; $("sound").appendChild(o); }

// custom pecut yang lagi dipilih
const bindCustom = (id, parse = Number) => $(id).addEventListener("input", (e) => {
  const val = parse(e.target.value);
  if (val === "" || val == null) delete custom()[id]; else custom()[id] = val;
  changed();
});
bindCustom("len"); bindCustom("bend"); bindCustom("grav");
bindCustom("rope", String); bindCustom("grip", String);
bindCustom("fx", String);
bindCustom("echo"); bindCustom("room"); bindCustom("pitch");
bindCustom("word", (s) => s.trim());
$("resetOne").onclick = () => {
  const f = custom().file;
  if (f) deleteSound(f.id);
  delete settings.custom[settings.variant]; changed();
};
$("showWord").addEventListener("change", (e) => { settings.showWord = e.target.checked; changed(); });

// umum
$("sensitivity").addEventListener("input", (e) => { settings.sensitivity = +(2 - e.target.value).toFixed(2); changed(); });
$("volume").addEventListener("input", (e) => { settings.volume = +e.target.value; sound.init(); changed(); });
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => {
  settings.mode = r.value; $("hint").style.opacity = "1"; changed();
}));
document.querySelectorAll('input[name="view"]').forEach((r) => r.addEventListener("change", () => { settings.view = r.value; changed(); }));
document.querySelectorAll('input[name="theme"]').forEach((r) => r.addEventListener("change", () => { settings.theme = r.value; changed(); }));
$("nag").addEventListener("change", (e) => { settings.nag = e.target.checked; changed(); });
$("autosend").addEventListener("change", (e) => { settings.autosend = e.target.checked; changed(); });
document.querySelectorAll(".lang").forEach((b) => (b.onclick = () => { settings.lang = b.dataset.lang; changed(); }));

// ---------- Suara: tes, suara sendiri, editor potong ----------
const T0 = { at: 0, len: 0 }; // playhead pas lagi dites
function test() {
  sound.init();
  const snd = effective(settings).sound;
  ensureSound(sound, snd).then(() => {
    sound.crack(1.1, snd, 0);
    const f = snd.file && sound.file(snd.file.id);
    if (f) {
      const start = snd.file.start ?? 0, end = snd.file.end ?? f.duration;
      T0.at = performance.now(); T0.len = ((end - start) / ((snd.file.rate ?? 1) * (snd.pitch ?? 1))) * 1000;
      T0.start = start; T0.end = end; animateHead();
    }
  });
  $("testSound").classList.add("on"); setTimeout(() => $("testSound").classList.remove("on"), 250);
}
$("testSound").onclick = test;

function fileNote(key) { $("fileNote").hidden = !key; $("fileNote").textContent = key ? S()[key] : ""; }

$("sound").addEventListener("change", (e) => {
  const v = e.target.value;
  if (v === "file") {
    if (custom().file) { custom().sound = "file"; changed(); }
    else { $("fileIn").click(); render(); } // balikin dropdown sampai file kepilih
    return;
  }
  if (v === settings.variant) delete custom().sound; else custom().sound = v;
  fileNote(null); changed();
});
$("replaceFile").onclick = () => $("fileIn").click();
$("fileIn").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  sound.init();
  let saved, data;
  try {
    data = await file.arrayBuffer();
    saved = await saveSound(file);
  } catch (err) { fileNote(err?.message === "too-big" ? "tooBig" : "badFile"); return; }
  await sound.addFile(saved.id, data);
  const buf = sound.file(saved.id);
  if (!buf) { deleteSound(saved.id); fileNote("badFile"); return; }
  const old = custom().file;
  if (old) deleteSound(old.id);
  // langsung mulai dari bunyi pertama (lewatin hening di awal), maks 2 detik
  const start = onset(buf);
  custom().file = { id: saved.id, name: saved.name, start, end: Math.min(buf.duration, start + 2), gain: 1 };
  custom().sound = "file";
  fileNote(null); changed();
  test();
});

function onset(buf) {
  const d = buf.getChannelData(0); let peak = 0;
  for (let i = 0; i < d.length; i += 16) peak = Math.max(peak, Math.abs(d[i]));
  const th = peak * 0.12;
  for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > th) return Math.max(0, i / buf.sampleRate - 0.005);
  return 0;
}

function renderEditor() {
  const c = custom(), on = c.sound === "file" && !!c.file;
  $("editor").hidden = !on;
  if (!on) return;
  $("fileName").textContent = c.file.name;
  setRange("fgain", RANGES.fgain, c.file.gain ?? 1); $("oFgain").textContent = pct(c.file.gain ?? 1);
  drawWave();
}
$("fgain").addEventListener("input", (e) => { custom().file.gain = +e.target.value; changed(); });

// gambar gelombang + area yang kepake
const peaks = new Map(); // id -> [min,max] per kolom
function drawWave(head) {
  const c = custom(), cv = $("wave");
  if ($("editor").hidden || !c.file) return;
  const buf = sound.file(c.file.id);
  const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth || 380, h = cv.clientHeight || 72;
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement), accent = css.getPropertyValue("--accent").trim(), muted = css.getPropertyValue("--muted").trim();
  if (!buf) {
    g.fillStyle = muted; g.font = "12px system-ui"; g.textAlign = "center"; g.fillText("…", w / 2, h / 2 + 4);
    return;
  }
  const dur = buf.duration, key = c.file.id + ":" + w;
  if (!peaks.has(key)) {
    const d = buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / w)), col = [];
    for (let x = 0; x < w; x++) {
      let lo = 0, hi = 0;
      for (let i = x * step, e = Math.min(d.length, i + step); i < e; i += 4) { const v = d[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      col.push([lo, hi]);
    }
    peaks.set(key, col);
  }
  const col = peaks.get(key), mid = h / 2;
  let peak = 0.01; for (const [lo, hi] of col) peak = Math.max(peak, -lo, hi);
  const start = c.file.start ?? 0, end = c.file.end ?? dur, xs = (start / dur) * w, xe = (end / dur) * w;
  g.fillStyle = accent; g.globalAlpha = 0.12; g.fillRect(xs, 0, xe - xs, h); g.globalAlpha = 1;
  col.forEach(([lo, hi], x) => {
    g.fillStyle = x >= xs && x <= xe ? accent : muted;
    g.globalAlpha = x >= xs && x <= xe ? 0.95 : 0.35;
    g.fillRect(x, mid + (lo / peak) * mid * 0.9, 1, Math.max(1, ((hi - lo) / peak) * mid * 0.9));
  });
  g.globalAlpha = 1; g.fillStyle = accent;
  for (const x of [xs, xe]) { g.fillRect(x - 1, 0, 2, h); g.fillRect(x - 4, 0, 8, 6); }
  if (head != null) { g.fillStyle = "#fff"; g.fillRect((head / dur) * w, 0, 1.5, h); }
  const fmt = (t) => t.toFixed(2) + "s";
  $("tStart").textContent = fmt(start); $("tEnd").textContent = fmt(end); $("tLen").textContent = "▸ " + fmt(end - start);
}
function animateHead() {
  const f = custom().file, buf = f && sound.file(f.id);
  if (!buf) return;
  const k = (performance.now() - T0.at) / T0.len;
  if (k >= 1) { drawWave(); return; }
  drawWave(T0.start + (T0.end - T0.start) * k);
  requestAnimationFrame(animateHead);
}

// seret garis awal / akhir, atau seret tengahnya buat geser
{
  const cv = $("wave");
  let drag = null;
  const at = (e) => {
    const f = custom().file, buf = f && sound.file(f.id), r = cv.getBoundingClientRect();
    return buf ? { t: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * buf.duration, buf, f, px: e.clientX - r.left, w: r.width } : null;
  };
  cv.addEventListener("pointerdown", (e) => {
    const p = at(e); if (!p) return;
    const { f, buf } = p, end = f.end ?? buf.duration, xs = (f.start / buf.duration) * p.w, xe = (end / buf.duration) * p.w;
    cv.setPointerCapture(e.pointerId);
    drag = Math.abs(p.px - xs) < 10 ? { k: "start" } : Math.abs(p.px - xe) < 10 ? { k: "end" } : p.px > xs && p.px < xe ? { k: "move", off: p.t - f.start, len: end - f.start } : { k: p.px < xs ? "start" : "end" };
    move(e);
  });
  const move = (e) => {
    if (!drag) return;
    const p = at(e); if (!p) return;
    const { f, buf } = p, min = 0.02;
    let end = f.end ?? buf.duration;
    if (drag.k === "start") f.start = Math.min(p.t, end - min);
    else if (drag.k === "end") f.end = Math.max(p.t, f.start + min);
    else { f.start = Math.max(0, Math.min(buf.duration - drag.len, p.t - drag.off)); f.end = f.start + drag.len; }
    drawWave();
  };
  cv.addEventListener("pointermove", move);
  cv.addEventListener("pointerup", () => { if (drag) { drag = null; changed(); test(); } });
}

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
  if (!/^[0-9]$/.test(e.key)) return;
  const i = (Number(e.key) + 9) % 10; // 1..9 -> 0..8, 0 -> 9
  if (i < KEYS.length) { settings.variant = KEYS[i]; changed(); }
});

// mulai
$("key").textContent = KEY;
document.querySelectorAll(".mac-only").forEach((el) => (el.hidden = !IS_MAC));
$("start").onclick = () => {
  clearTimeout(saveTimer);
  if (TAURI) TAURI.core.invoke("save_settings", { settings }).then(() => TAURI.core.invoke("start"));
};
if (!TAURI) $("start").hidden = true;

sound.init(); // context dibikin duluan (masih "tidur") biar gelombang suara sendiri bisa digambar
settings = await load();
render();
save(); // simpan sekali biar Rust juga tau bahasa default-nya
