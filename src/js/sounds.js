// Suara sendiri: file audio yang dimasukin user buat bunyi ctarr.
// Di app desktop disimpan Rust ke folder config (sounds/<id>), di browser ke IndexedDB.
const TAURI = window.__TAURI__;
export const MAX_BYTES = 8 * 1024 * 1024; // 8 MB cukup buat potongan suara

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
    if (TAURI) return await TAURI.core.invoke("load_sound", { id });
    return (await idb("readonly", (s) => s.get(id))) || null;
  } catch (e) {
    console.warn("suara nggak ketemu", id, e);
    return null;
  }
}

export async function deleteSound(id) {
  try {
    if (TAURI) await TAURI.core.invoke("delete_sound", { id });
    else await idb("readwrite", (s) => s.delete(id));
  } catch {}
}

// pastiin file suara yang kepake pecut ini udah dimuat ke Sound.
// Balikin false kalau file-nya udah nggak ada (bunyinya balik ke ctarr bawaan).
const loading = new Map();
export async function ensureSound(sound, snd) {
  const id = snd?.file?.id;
  if (!id || sound.file(id)) return true;
  if (!loading.has(id)) {
    loading.set(id, loadSound(id).then(async (data) => (data ? !!(await sound.addFile(id, data)) || !sound.ac : false)));
  }
  const ok = await loading.get(id);
  if (!ok) loading.delete(id);
  return ok;
}
