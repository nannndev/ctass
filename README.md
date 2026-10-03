# Ctas

Pecut realistis buat mecut AI biar rajin. Ayun mouse, sentak, **CTARR!**

Ctas itu overlay transparan di atas layar (macOS, Windows, Linux). Pas AI lu lelet, halu, atau ngeles,
tekan **⌘⇧X**, pecut sepuasnya, terus tekan **Esc**. Lumayan buat ngelampiasin kesel.

## Fitur

- **Fisika tali beneran.** Talinya disimulasikan pakai integrasi Verlet: ada gravitasi,
  redaman, kekakuan lentur, dan makin ke ujung makin runcing.
- **Bunyi CTARR kalau ujungnya tembus "Mach 1".** Pecut asli bunyi karena ujungnya
  lebih cepat dari suara. Di sini kecepatan ujung diukur tiap sub-step, dan bunyinya
  makin keras kalau makin kenceng.
- **Suara pecut asli + sintesis:** Jaranan, Cambuk sapi, Bullwhip, Samandiman, Cemeti, dan Cambuk api
  pakai rekaman cambuk beneran (nadanya digeser dikit tiap ctarr biar nggak monoton), plus lapisan khasnya
  (desir rumbai, denting, api). Pecut lain disintesis langsung pakai Web Audio. Ayun pelan nggak bunyi,
  harus disentak.
- **17 pecut, beda suara & efek:** Jaranan, Cambuk sapi, Bullwhip, Samandiman, Cemeti,
  Sapu lidi (srak!), Kabel charger (zzt!), Ikat pinggang (plak!), Cambuk api (bwosh!), Cambuk plasma (vzwap!),
  plus 7 futuristik: Hologram (bzzrt!), Logam cair (shhing!), Rantai energi (klangg!), Tesla (krzzak!),
  Lubang hitam (vwuum!), Fiber optik (pew!), Lengan robot (klank!)
- **Bisa dicustom** di jendela Ctas: panjang, kekakuan, berat, warna tali & gagang,
  campur suara & efek dari pecut lain, tulisan pas ctarr, gampang/susahnya bunyi, volume.
  Ada preview buat nyobain langsung, dan pengaturannya disimpan. Tulisan pas ctarr bisa dimatiin.
- **Hidup pas diem:** didiemin bentar, pecutnya goyang pelan kayak ketiup angin.
- **Scroll = gulung tali** (di preview & demo web): scroll ke bawah talinya ngegulung ke gagang,
  ke atas diulur lagi. Dilepas bentar, keulur sendiri.
- **Tampilan 2D / 3D:** semua pecut ada versi 3D (tali kepang, lidi, sabuk pipih + gesper, kabel + colokan,
  pendar buat yang nyala) pakai Three.js. Defaultnya 2D biar ringan; Three.js baru dimuat kalau 3D dinyalain.
- **Tema klasik / futuristik:** futuristik = neon cyan, lantai grid, tulisan nyala.
- **Atur suara:** tombol tes, gema, ruang (reverb), nada. Bisa pakai **suara sendiri** (mp3/wav/ogg/m4a, maks 8 MB)
  plus editor: lihat gelombangnya, potong awal & akhir, atur volume.
  Ada juga suara bawaan siap pakai: Special #1 dan Special #2.
- **Update otomatis:** Ctas ngecek versi baru pas dibuka. Kalau ada, tinggal klik "Update sekarang".
  Buka Ctas lagi pas udah jalan = jendela yang lama yang muncul, nggak dobel.
- **Dua bahasa:** Indonesia & English (landing page sama app).

## Pakai

Pas dibuka, muncul **jendela Ctas**: pilih pecut, custom, cobain di preview, terus klik
**Mulai mecut**. Jendelanya boleh ditutup, Ctas tetap jalan di menu bar (Mac) / system tray
(Windows, Linux). Klik ikonnya buat buka jendela Ctas lagi.

| Aksi | Caranya |
| --- | --- |
| Mulai / udahan mecut | ⌘⇧X di Mac, Ctrl+Alt+X di Windows/Linux |
| Ganti & custom pecut | Jendela Ctas (angka 1–9 juga bisa) |
| Ctarr (mode **Ikut kursor**) | Ayun mouse terus balik arah mendadak |
| Ctarr (mode **Klik = pecut**) | Klik di mana aja, pecut melesat dari pojok, nyabet titik itu, terus balik. Double klik = dua kali |
| Pindahin pecut (mode klik) | Tekan gagangnya, tahan, seret ke tempat lain |

Overlay-nya tembus klik dan nggak ngambil fokus, jadi selama mecut lu tetap bisa klik dan
ngetik kayak biasa. Pecutnya cuma nempel di kursor.

Kalau ctarr-nya susah keluar, geser **Gampang bunyi** ke kanan, atau pakai mode **Klik = pecut**
yang pasti bunyi tiap klik. Mode klik di overlay jalan di Mac & Windows (di Linux baru di preview).

## Install

Ambil dari [release terbaru](https://github.com/nannndev/ctass/releases/latest):

| OS | File |
| --- | --- |
| macOS 11+ (Apple Silicon & Intel) | `Ctas-macOS.dmg` |
| Windows 10/11 | `Ctas-Windows-setup.exe` |
| Linux x64 | `Ctas-Linux.AppImage` atau `Ctas-Linux.deb` |

**macOS.** App-nya belum di-sign Apple, jadi macOS bakal nolak waktu pertama dibuka:

1. Drag Ctas ke **Applications**.
2. Kalau muncul "Ctas is damaged" / "rusak", jalanin di Terminal:
   ```sh
   xattr -cr /Applications/Ctas.app
   ```
3. Kalau muncul "can't be opened", buka **System Settings → Privacy & Security** → **Open Anyway**.

Ctas nggak muncul di Dock. Ikonnya ada di menu bar, dan overlay pecutnya langsung muncul sekali waktu app dibuka.

**Windows.** Kalau muncul SmartScreen ("Windows protected your PC"), klik **More info → Run anyway**.
Ikonnya ada di system tray.

**Linux.** `chmod +x Ctas-Linux.AppImage && ./Ctas-Linux.AppImage`, atau install `.deb`-nya.
Butuh X11: di Wayland pecutnya belum bisa ngikutin kursor.

## Develop

Butuh Node 22+ dan Rust stable.

```sh
npm install
npm run dev        # app desktop, hot reload
npm run web        # landing page + demo di http://localhost:3000
npm run build:mac  # .app + .dmg universal (Apple Silicon + Intel)
npm run build      # build buat OS yang lagi dipake
```

Struktur:

```
src/                 frontend (HTML/CSS/JS polos, tanpa bundler)
  js/physics.js      simulasi tali Verlet
  js/audio.js        sintesis suara
  js/variants.js     parameter tiap varian
  js/stage.js        render, input, deteksi ctarr (dipakai app & landing)
  js/main.js         overlay + jembatan ke Tauri
  js/panel.js        jendela Ctas (pilih & custom pecut)
  js/settings.js     pengaturan + gabungin custom ke pecut
web/                 landing page (Vercel)
src-tauri/           shell desktop (Tauri 2)
  src/lib.rs         overlay, shortcut global, menu bar
```

### Rilis

Naikin `version` di `src-tauri/tauri.conf.json`, terus push ke `main`. CI bakal build `.dmg`
dan bikin (atau update) GitHub Release `v<versi>` berisi `Ctas-macOS.dmg`, jadi link download
di landing page otomatis ngarah ke versi terbaru.

### Landing page (Vercel)

Import repo ini di Vercel, nggak perlu ubah setting apa-apa karena udah diatur di
`vercel.json`. Build-nya cuma nyalin `web/` + mesin pecut dari `src/js` ke `dist/`.
Versi browser full layar ada di `/play`.

### Nambah varian

Tambah entri di `src/js/variants.js`. Parameter yang paling ngaruh:

- `segs`, `len`: jumlah & panjang segmen tali
- `bend`: kekakuan (makin gede makin kaku)
- `damp`: redaman (makin deket 1 makin lama goyangnya)
- `threshold`: kecepatan ujung (px/s) yang dihitung sebagai Mach 1
- `sound`: resep suara (panjang sonic boom, desis, dentum, gema, lapisan khas)
- `fx`, `word`, `color`, `shake`: efek visual pas ctarr

## Roadmap

- [x] Windows & Linux
- [ ] Wayland
- [ ] Varian lain: sapu lidi, sandal jepit, kabel charger
- [ ] Rekam suara pecut asli sebagai opsi
- [ ] Haptic trackpad pas CTARR

## Auto-update (buat yang maintain)

File update ditandatangani pakai kunci Tauri. Kunci privatnya disimpan di GitHub
Secrets `TAURI_SIGNING_PRIVATE_KEY` (tanpa password). Kalau secret-nya belum ada,
CI tetap build kayak biasa, cuma `latest.json` nggak dibikin jadi app nggak dapet update.
Kunci publiknya ada di `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.

## Kredit suara

Rekaman cambuk (`src/sounds/whip-*.mp3`) dari [Universfield](https://pixabay.com/users/universfield-28281460/)
di Pixabay, dipakai sesuai [Pixabay Content License](https://pixabay.com/service/license-summary/).
