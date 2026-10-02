// Landing page: demo pakai mesin yang sama persis dengan app desktop (disalin ke /engine waktu build).
import { VARIANTS } from "/engine/variants.js";
import { Sound } from "/engine/audio.js";
import { createStage } from "/engine/stage.js";
import { drawSwatch } from "/engine/swatch.js";
import { detectLang, translateDom, whipName } from "/engine/i18n.js";
import { EN, EN_DYNAMIC as E } from "/en.js";

const $ = (id) => document.getElementById(id);
const sound = new Sound();
const demo = document.querySelector(".demo");
const IS_MAC = /Mac/i.test(navigator.userAgent);
const TRANSLATE = "nav a, a.btn, .eyebrow, h1, h2, h3, main p, main li:not(.steps li), figcaption, dt, .demo-hint, .foot span";

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
  },
  try: "Coba",
  download: { mac: "Download buat Mac", win: "Download buat Windows", linux: "Download buat Linux", none: "Download" },
  soundOn: "Suara on", soundOff: "Suara off",
  wordOn: "Tulisan on", wordOff: "Tulisan off",
  modeFollow: "Mode: ikut kursor", modeClick: "Mode: klik = pecut",
  hintClick: "<strong>Klik di mana aja.</strong>Pecutnya nyabet titik itu. Double klik = dua kali. Seret gagangnya buat mindahin.",
  hintFollow: "<strong>Klik, terus ayun dan sentak.</strong>Ayun pelan nggak bunyi. Harus disentak.",
  nag: "[Ctas] Kamu barusan dipecut 7 kali, 2 kali kena muka. Cepetan dong, jangan halu, langsung kerjain.",
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
  document.querySelectorAll(".chips .chip[data-k]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.k === k)));
}

// ---------- Tombol demo ----------
let showWord = true;
$("sound").onclick = () => { sound.init(); sound.on = !sound.on; labels(); };
$("wordBtn").onclick = () => { showWord = !showWord; stage.setShowWord(showWord); labels(); };
$("modeBtn").onclick = () => {
  sound.init();
  stage.setMode(stage.mode === "click" ? "follow" : "click");
  $("hint").style.opacity = "1";
  labels();
};
addEventListener("keydown", (e) => {
  const keys = Object.keys(VARIANTS), n = Number(e.key);
  if (n >= 1 && n <= keys.length && !e.metaKey && !e.ctrlKey && !e.altKey) pick(keys[n - 1]);
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
  $("langBtn").textContent = lang === "en" ? "ID" : "EN";
  $("langBtn").title = lang === "en" ? "Ganti ke Bahasa Indonesia" : "Switch to English";
  document.title = lang === "en" ? "Ctas · a virtual whip" : "Ctas · pecut virtual";
  labels();
  retype();
}
$("langBtn").onclick = () => {
  lang = lang === "en" ? "id" : "en";
  try { localStorage.setItem("ctas.lang", lang); } catch {}
  applyLang();
};

// ---------- Contoh omelan, diketik ulang waktu kelihatan ----------
const typed = $("typed");
let typer = 0, seen = false;
function retype() {
  const NAG = L().nag;
  clearInterval(typer);
  if (!seen || matchMedia("(prefers-reduced-motion: reduce)").matches) { typed.textContent = NAG; return; }
  let i = 0; typed.textContent = "";
  typer = setInterval(() => { typed.textContent = NAG.slice(0, ++i); if (i >= NAG.length) clearInterval(typer); }, 28);
}
if ("IntersectionObserver" in window) {
  new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting) return;
    seen = true; obs.disconnect(); retype();
  }, { threshold: 0.6 }).observe(typed);
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
