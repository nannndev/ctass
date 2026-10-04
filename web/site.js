// Landing page: demo pakai mesin yang sama persis dengan app desktop (disalin ke /engine waktu build).
import { VARIANTS } from "/engine/variants.js";
import { Sound } from "/engine/audio.js";
import { createStage } from "/engine/stage.js";
import { drawSwatch } from "/engine/swatch.js";
import { detectLang, translateDom, whipName } from "/engine/i18n.js";
import { EN, EN_DYNAMIC as E } from "/en.js";
import { ensureSound, loadSwing } from "/engine/sounds.js";

const $ = (id) => document.getElementById(id);
const sound = new Sound();
const demo = document.querySelector(".demo");
const IS_MAC = /Mac/i.test(navigator.userAgent);
const TRANSLATE = "nav a, a.btn:not(#starBtn), .eyebrow, h1, h2, h3, main p, main li:not(.steps li), figcaption, dt, .demo-hint, .foot span";

let lang = "id";
try { lang = localStorage.getItem("ctas.lang") || detectLang(); } catch { lang = detectLang(); }

const ID = {
  blurbs: {
    jaranan: "Pecut kuda lumping, lengkap sama rumbainya.",
    sapi: "Pendek dan berat. Gampang bunyi.",
    bullwhip: "Paling panjang, paling susah. Paling puas juga.",
    samandiman: "Versi sakti. Ada percikannya.",
    cemeti: "Tipis, kaku, bunyinya nyaring.",
    sapulidi: "Senjata andalan emak. Srak!",
    kabel: "Kabel charger yang udah nggak kepake. Nyetrum dikit.",
    sabuk: "Ikat pinggang bapak. Lu tau rasanya.",
    api: "Cambuk berapi. Ada bara yang ngikutin ujungnya.",
    plasma: "Dari masa depan. Dengung, nyala, vzwap.",
    hologram: "Tembus pandang, kedip-kedip, kadang nge-glitch.",
    chrome: "Logam cair ala film robot. Beriak, mengkilap, nyiprat.",
    rantai: "Rantai besi yang sambungannya nyala. Klang!",
    tesla: "Listrik loncat-loncat di sepanjang tali. Kretek!",
    blackhole: "Ujungnya lubang hitam. Semua kesedot ke tengah.",
    fiber: "Kabel cahaya. Makin kenceng diayun, denyutnya makin cepet.",
    robot: "Lengan robot kaku dengan capit di ujung. Servo bunyi.",
  },
  try: "Coba",
  download: { mac: "Download buat Mac", win: "Download buat Windows", linux: "Download buat Linux", none: "Download" },
  soundOn: "Suara on", soundOff: "Suara off",
  wordOn: "Tulisan on", wordOff: "Tulisan off",
  modeFollow: "Mode: ikut kursor", modeClick: "Mode: klik = pecut",
  view2d: "Tampilan: 2D", view3d: "Tampilan: 3D", view3dFail: "3D nggak didukung browser ini",
  themeClassic: "Tema: klasik", themeFuture: "Tema: futuristik",
  swingOn: "Ayunan: on", swingOff: "Ayunan: off",
  hintClick: "<strong>Klik di mana aja.</strong>Pecutnya nyabet titik itu. Double klik = dua kali. Seret gagangnya buat mindahin.",
  hintFollow: "<strong>Klik, terus ayun dan sentak.</strong>Ayun pelan nggak bunyi. Harus disentak.",
  star: "★ Star di GitHub", seeAll: "Lihat semua",
  downloads: (n) => `⬇ <b>${n}</b> kali di-download`,
  copied: "Ke-copy", copy: "Copy", pressCopy: (mac) => (mac ? "Tekan ⌘C" : "Tekan Ctrl+C"),
};
const L = () => (lang === "en" ? E : ID);

let bubbleTimer = 0;
const stage = createStage({
  canvas: $("stage"),
  sound,
  onFirstMove: () => { $("hint").style.opacity = "0"; },
  onScore: (s) => {
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
  b.className = "chip"; b.dataset.k = k;
  b.onclick = () => { sound.init(); pick(k); };
  chips.appendChild(b);

  const card = document.createElement("article");
  card.className = "card"; card.dataset.k = k;
  card.innerHTML = `<canvas aria-hidden="true"></canvas><h3></h3><p></p><button class="chip" data-k="${k}"></button>`;
  card.querySelector("button").onclick = () => {
    sound.init(); pick(k);
    demo.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  };
  cards.appendChild(card);
  drawSwatch(card.querySelector("canvas"), v);
});
function pick(k) {
  stage.pick(k);
  ensureSound(sound, VARIANTS[k].sound); // pecut yang pakai rekaman asli: muat file-nya
  document.querySelectorAll(".chips .chip[data-k]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.k === k)));
  labels();
}

// ---------- Tombol demo ----------
let showWord = true;
$("sound").onclick = () => { sound.init(); sound.on = !sound.on; labels(); };
$("wordBtn").onclick = () => { showWord = !showWord; stage.setShowWord(showWord); labels(); };
let view3dFail = false;
$("viewBtn").onclick = async () => {
  if (stage.is3D) { await stage.set3D(false); labels(); return; }
  const ok = await stage.set3D(true);
  view3dFail = !ok;
  labels();
};
let swingOn = false;
$("swingBtn").onclick = () => {
  sound.init(); swingOn = !swingOn;
  sound.setSwing(swingOn, 0.8);
  if (swingOn) loadSwing(sound);
  labels();
};
let future = false;
$("themeBtn").onclick = () => {
  future = !future;
  stage.setTheme(future ? "future" : "classic");
  demo.classList.toggle("is-future", future);
  labels();
};
$("modeBtn").onclick = () => {
  sound.init();
  stage.setMode(stage.mode === "click" ? "follow" : "click");
  $("hint").style.opacity = "1";
  labels();
};
addEventListener("keydown", (e) => {
  const keys = Object.keys(VARIANTS), i = (Number(e.key) + 9) % 10;
  if (/^[0-9]$/.test(e.key) && i < keys.length && !e.metaKey && !e.ctrlKey && !e.altKey) pick(keys[i]);
});

// ---------- Tombol download ngikutin OS pengunjung ----------
const ua = navigator.userAgent;
const OS = /Windows/i.test(ua) ? "win" : /Mac/i.test(ua) && !/iPhone|iPad/i.test(ua) ? "mac" : /Linux/i.test(ua) && !/Android/i.test(ua) ? "linux" : null;
if (OS) {
  const mine = document.querySelector(`#dlButtons [data-os="${OS}"]`);
  mine.classList.add("is-you");
  $("heroDl").href = mine.href;
}

// ---------- Teks yang ikut bahasa ----------
function labels() {
  const T = L(), click = stage.mode === "click";
  $("sound").textContent = sound.on ? T.soundOn : T.soundOff;
  $("sound").setAttribute("aria-pressed", String(sound.on));
  $("wordBtn").textContent = showWord ? T.wordOn : T.wordOff;
  $("wordBtn").setAttribute("aria-pressed", String(showWord));
  $("modeBtn").textContent = click ? T.modeClick : T.modeFollow;
  $("modeBtn").setAttribute("aria-pressed", String(click));
  $("hint").innerHTML = click ? T.hintClick : T.hintFollow;
  const on = stage.is3D;
  $("viewBtn").textContent = view3dFail ? T.view3dFail : on ? T.view3d : T.view2d;
  $("themeBtn").textContent = future ? T.themeFuture : T.themeClassic;
  $("swingBtn").textContent = swingOn ? T.swingOn : T.swingOff;
  $("swingBtn").setAttribute("aria-pressed", String(swingOn));
  $("themeBtn").setAttribute("aria-pressed", String(future));
  $("viewBtn").setAttribute("aria-pressed", String(on));
}
function applyLang() {
  translateDom(document.body, EN, lang, TRANSLATE);
  const T = L();
  document.querySelectorAll(".chips .chip[data-k]").forEach((c) => (c.textContent = whipName(c.dataset.k, VARIANTS[c.dataset.k], lang)));
  document.querySelectorAll(".card").forEach((c) => {
    const k = c.dataset.k;
    c.querySelector("h3").textContent = whipName(k, VARIANTS[k], lang);
    c.querySelector("p").textContent = T.blurbs[k];
    c.querySelector("button").textContent = T.try;
  });
  $("heroDl").textContent = T.download[OS || "none"];
  $("starBtn").firstChild.textContent = T.star + " ";
  $("contributors").querySelector(".more").textContent = T.seeAll;
  if (typeof showDownloads === "function") showDownloads();
  $("langBtn").textContent = lang === "en" ? "ID" : "EN";
  $("langBtn").title = lang === "en" ? "Ganti ke Bahasa Indonesia" : "Switch to English";
  document.title = lang === "en" ? "Ctas: Free Virtual Whip for Mac, Windows & Linux" : "Ctas: Pecut Virtual Gratis untuk Mac, Windows & Linux";
  labels();
}
$("langBtn").onclick = () => {
  lang = lang === "en" ? "id" : "en";
  try { localStorage.setItem("ctas.lang", lang); } catch {}
  applyLang();
};

// ---------- Jumlah download (total file installer di semua GitHub Release) ----------
const INSTALLERS = /^Ctas-(macOS\.dmg|Windows-setup\.exe|Linux\.AppImage|Linux\.deb)$/;
let downloads = 0;
function showDownloads() {
  if (!downloads) return;
  const n = downloads.toLocaleString(lang === "en" ? "en-US" : "id-ID");
  for (const id of ["dlCountHero", "dlCount"]) { $(id).innerHTML = L().downloads(n); $(id).hidden = false; }
}
fetch("https://api.github.com/repos/nannndev/ctass/releases?per_page=100").then((r) => (r.ok ? r.json() : [])).then((rels) => {
  downloads = (Array.isArray(rels) ? rels : []).reduce((sum, r) => sum + (r.assets || []).reduce((s, a) => s + (INSTALLERS.test(a.name) ? a.download_count : 0), 0), 0);
  showDownloads();
}).catch(() => {});

// ---------- Open source: bintang, contributor, donasi ----------
const REPO = "nannndev/ctass";
// Isi link donasi di sini (Saweria / Trakteer / GitHub Sponsors / Ko-fi). Kosong = kartu donasi disembunyiin.
const DONATE = [{ label: "☕ Buy me a coffee", url: "https://buymeacoffee.com/ekaprasety8" }];
fetch(`https://api.github.com/repos/${REPO}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
  if (d && typeof d.stargazers_count === "number") $("starCount").textContent = d.stargazers_count;
}).catch(() => {});
fetch(`https://api.github.com/repos/${REPO}/contributors?per_page=24`).then((r) => (r.ok ? r.json() : [])).then((list) => {
  const box = $("contributors"), more = box.querySelector(".more");
  (Array.isArray(list) ? list : []).filter((c) => c.type !== "Bot").forEach((c) => {
    const a = document.createElement("a");
    a.className = "av"; a.href = c.html_url; a.target = "_blank"; a.rel = "noopener";
    a.title = `${c.login} · ${c.contributions} commit`;
    const img = document.createElement("img");
    img.src = c.avatar_url + "&s=80"; img.alt = c.login; img.loading = "lazy"; img.width = 40; img.height = 40;
    a.appendChild(img); box.insertBefore(a, more);
  });
}).catch(() => {});
if (DONATE.length) {
  $("donateCard").hidden = false;
  DONATE.forEach(({ label, url }, i) => {
    const a = document.createElement("a");
    a.className = i ? "btn btn-ghost" : "btn"; a.href = url; a.target = "_blank"; a.rel = "noopener"; a.textContent = label;
    $("donateBtns").appendChild(a);
  });
}

// ---------- Tombol copy perintah install ----------
document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const el = $(btn.dataset.copy), T = L();
    try {
      await navigator.clipboard.writeText(el.textContent);
      btn.textContent = T.copied;
    } catch {
      const r = document.createRange(); r.selectNodeContents(el);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      btn.textContent = T.pressCopy(IS_MAC);
    }
    setTimeout(() => (btn.textContent = L().copy), 1800);
  });
});

pick("jaranan");
applyLang();
