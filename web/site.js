// Landing page: demo pakai mesin yang sama persis dengan app desktop (disalin ke /engine waktu build).
import { VARIANTS } from "/engine/variants.js";
import { Sound } from "/engine/audio.js";
import { createStage } from "/engine/stage.js";
import { drawSwatch } from "/engine/swatch.js";

const $ = (id) => document.getElementById(id);
const sound = new Sound();
const demo = document.querySelector(".demo");

const BLURB = {
  jaranan: "Pecut kuda lumping, lengkap sama rumbainya.",
  sapi: "Pendek dan berat. Gampang bunyi.",
  bullwhip: "Paling panjang, paling susah. Paling puas juga.",
  samandiman: "Versi sakti. Ada percikannya.",
  cemeti: "Tipis, kaku, bunyinya nyaring.",
  sapulidi: "Senjata andalan emak. Srak!",
  kabel: "Kabel charger yang udah nggak kepake. Nyetrum dikit.",
  sabuk: "Ikat pinggang bapak. Lu tau rasanya.",
  api: "Cambuk berapi. Ada bara yang ngikutin ujungnya.",
};

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

// ---------- Tombol copy perintah install ----------
document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const el = $(btn.dataset.copy);
    try {
      await navigator.clipboard.writeText(el.textContent);
      btn.textContent = "Ke-copy";
    } catch {
      const r = document.createRange(); r.selectNodeContents(el);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      btn.textContent = /Mac/i.test(navigator.userAgent) ? "Tekan ⌘C" : "Tekan Ctrl+C";
    }
    setTimeout(() => (btn.textContent = "Copy"), 1800);
  });
});

// ---------- Tombol download ngikutin OS pengunjung ----------
const ua = navigator.userAgent;
const OS = /Windows/i.test(ua) ? "win" : /Mac/i.test(ua) && !/iPhone|iPad/i.test(ua) ? "mac" : /Linux/i.test(ua) && !/Android/i.test(ua) ? "linux" : null;
const LABEL = { mac: "Download buat Mac", win: "Download buat Windows", linux: "Download buat Linux" };
if (OS) {
  const mine = document.querySelector(`#dlButtons [data-os="${OS}"]`);
  mine.classList.add("is-you");
  $("heroDl").href = mine.href;
  $("heroDl").textContent = LABEL[OS];
}
