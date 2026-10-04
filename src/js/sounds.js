// Suara sendiri: file audio yang dimasukin user buat bunyi ctarr.
// Di app desktop disimpan Rust ke folder config (sounds/<id>), di browser ke IndexedDB.
const TAURI = window.__TAURI__;
export const MAX_BYTES = 8 * 1024 * 1024; // 8 MB cukup buat potongan suara

// Suara bawaan yang ikut di app (folder src/sounds). Dipakai lewat editor yang sama
// kayak suara sendiri, jadi bisa dipotong & diatur volumenya juga.
// URL dihitung dari lokasi file ini (js/ -> ../sounds/), jadi jalan di app, /play, dan demo landing.
const at = (f) => new URL(`../sounds/${f}`, import.meta.url).href;
export const PRESETS = {
  "preset:special1": { name: "Special #1", url: at("special-1.mp3") },
  "preset:special2": { name: "Special #2", url: at("special-2.mp3") },
  "preset:special3": { name: "Special #3", url: at("special-3.mp3") },
};
// rekaman pecut asli yang dipakai beberapa pecut (lihat `file` di variants.js), nggak muncul di dropdown
const SAMPLES = {
  "sample:crack": { url: at("whip-crack.mp3") },
  "sample:snap": { url: at("whip-snap.mp3") },
  "sample:heavy": { url: at("whip-heavy.mp3") },
  "sample:swingloop": { url: at("swing-loop.wav") }, // suara ayunan (loop cambuk diputer)
  "sample:swish": { url: at("swing-swish.wav") },    // 10 wush satuan, masing-masing 0,4 detik
};
const BUILTIN = { ...PRESETS, ...SAMPLES };
export const isPreset = (id) => typeof id === "string" && (id.startsWith("preset:") || id.startsWith("sample:"));

const newId = (name) => {
  const ext = (name.match(/\.([a-z0-9]{1,5})$/i)?.[1] || "audio").toLowerCase();
  const rnd = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${rnd}.${ext}`;
};

// IndexedDB kecil buat versi browser
function db() {
  return new Promise((ok, bad) => {
    const r = indexedDB.open("ctas-sounds", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  });
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((ok, bad) => {
    const tx = d.transaction("files", mode), req = fn(tx.objectStore("files"));
    tx.oncomplete = () => ok(req?.result);
    tx.onerror = () => bad(tx.error);
  });
}

// simpan file, balikin { id, name }
export async function saveSound(file) {
  if (file.size > MAX_BYTES) throw new Error("too-big");
  const id = newId(file.name), data = await file.arrayBuffer();
  if (TAURI) await TAURI.core.invoke("save_sound", new Uint8Array(data), { headers: { "x-sound-id": id } });
  else await idb("readwrite", (s) => s.put(data, id));
  return { id, name: file.name.slice(0, 60) };
}

// ambil isi file (ArrayBuffer) atau null kalau udah nggak ada
export async function loadSound(id) {
  try {
    if (isPreset(id)) {
      const r = await fetch(BUILTIN[id]?.url || "");
      return r.ok ? await r.arrayBuffer() : null;
    }
    if (TAURI) return await TAURI.core.invoke("load_sound", { id });
    return (await idb("readonly", (s) => s.get(id))) || null;
  } catch (e) {
    console.warn("suara nggak ketemu", id, e);
    return null;
  }
}

export async function deleteSound(id) {
  if (isPreset(id)) return; // bawaan app, jangan dihapus
  try {
    if (TAURI) await TAURI.core.invoke("delete_sound", { id });
    else await idb("readwrite", (s) => s.delete(id));
  } catch {}
}

// muat rekaman buat suara ayunan
export const loadSwing = (sound) => Promise.all(["sample:swingloop", "sample:swish"].map((id) => ensureSound(sound, { file: { id } })));

// pastiin file suara yang kepake pecut ini udah dimuat ke Sound.
// Balikin false kalau file-nya udah nggak ada (bunyinya balik ke ctarr bawaan).
const caches = new WeakMap(); // per objek Sound, biar dua Sound di satu halaman nggak saling ketuker
export async function ensureSound(sound, snd) {
  const id = snd?.file?.id;
  if (!id || sound.file(id)) return true;
  if (!caches.has(sound)) caches.set(sound, new Map());
  const loading = caches.get(sound);
  if (!loading.has(id)) {
    loading.set(id, loadSound(id).then(async (data) => (data ? !!(await sound.addFile(id, data)) || !sound.ac : false)));
  }
  const ok = await loading.get(id);
  if (!ok) loading.delete(id);
  return ok;
}
