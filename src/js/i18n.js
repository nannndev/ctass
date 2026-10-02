// Dua bahasa: "id" (Indonesia, teks asli di HTML) dan "en" (English).
// Teks statis di HTML diterjemahin pakai kamus: kunci = isi HTML aslinya (spasi dirapihin).

export const LANGS = ["id", "en"];

export function detectLang() {
  const l = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  return l.startsWith("id") || l.startsWith("ms") ? "id" : "en";
}

const norm = (h) => h.replace(/\s+/g, " ").trim();

// Terjemahin elemen yang cocok `selector` di dalam `root`. Elemen yang berisi tombol /
// input nggak diganti utuh (biar event listener-nya aman); anak-anaknya yang diterjemahin.
export function translateDom(root, dict, lang, selector) {
  const table = {};
  for (const k in dict) table[norm(k)] = dict[k];
  const visit = (el) => {
    for (const c of el.children) {
      if (c.matches(selector) && !c.querySelector("button, input, select, canvas")) {
        if (c.__i18n == null) c.__i18n = c.innerHTML;
        const en = table[norm(c.__i18n)];
        c.innerHTML = lang === "en" && en != null ? en : c.__i18n;
      } else visit(c);
    }
  };
  visit(root);
  document.documentElement.lang = lang;
}

// Teks dinamis
const T = {
  ctarr: { id: "ctarr", en: "cracks" },
  modeFollow: { id: "sentak buat ctarr", en: "flick to crack" },
  modeClick: { id: "klik buat nyabet", en: "click to whip" },
  stop: { id: "buat udahan", en: "to stop" },
  clickToSound: { id: "Klik sekali buat nyalain suara", en: "Click once to turn on sound" },
};
export const t = (key, lang) => T[key]?.[lang] ?? T[key]?.id ?? key;

// Nama pecut dalam bahasa Inggris (yang nama khas tetap aslinya)
const NAMES_EN = {
  jaranan: "Jaranan", sapi: "Cattle whip", bullwhip: "Bullwhip", samandiman: "Samandiman", cemeti: "Cemeti",
  sapulidi: "Broom", kabel: "Charger cable", sabuk: "Belt", api: "Fire whip",
};
export const whipName = (key, v, lang) => (lang === "en" ? NAMES_EN[key] || v.name : v.name);
