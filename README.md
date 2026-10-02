# Ctas

Pecut realistis buat mecut AI biar rajin. Ayun mouse, sentak, **CTARR!**

Ctas itu overlay transparan di atas layar Mac. Pas AI lu lelet, halu, atau ngeles,
tekan **⌘⇧X**, pecut sepuasnya, terus tekan **Esc**. Omelan lu langsung diketik
ke jendela AI yang tadi aktif (Claude, ChatGPT, terminal, apa aja).

## Fitur

- **Fisika tali beneran.** Talinya disimulasikan pakai integrasi Verlet: ada gravitasi,
  redaman, kekakuan lentur, dan makin ke ujung makin runcing.
- **Bunyi CTARR kalau ujungnya tembus "Mach 1".** Pecut asli bunyi karena ujungnya
  lebih cepat dari suara. Di sini kecepatan ujung diukur tiap sub-step, dan bunyinya
  makin keras kalau makin kenceng.
- **Suara disintesis pakai Web Audio**, nggak ada file rekaman: letupan, dentuman,
  klik, gema, plus "wush" pas diayun.
- **5 varian** (tombol 1–5): Jaranan, Cambuk sapi, Bullwhip, Samandiman, Cemeti.
- **Robot AI** yang bisa disabet, lengkap sama omelan baliknya.

## Pakai

| Aksi | Tombol |
| --- | --- |
| Mulai mecut | ⌘⇧X atau ikon Ctas di menu bar |
| Ganti varian | 1–5, atau klik chip di atas |
| Udahan, kirim omelan | Esc atau ⌘⇧X lagi |

Di menu bar ada dua pilihan:

- **Ketik omelan ke AI pas udahan** (default nyala)
- **Langsung kirim (tekan Enter)** (default mati, jadi lu masih bisa baca dulu sebelum kekirim)

Pertama kali ngetik omelan, macOS bakal minta izin **Accessibility** buat Ctas
(System Settings → Privacy & Security → Accessibility). Itu wajib biar Ctas bisa ngetik
ke app lain.

## Install

Download `.dmg` terbaru: https://github.com/nannndev/ctass/releases/latest/download/Ctas-macOS.dmg

App-nya belum di-sign Apple, jadi macOS bakal nolak waktu pertama dibuka:

1. Drag Ctas ke **Applications**.
2. Kalau muncul "Ctas is damaged" / "rusak", jalanin di Terminal:
   ```sh
   xattr -cr /Applications/Ctas.app
   ```
3. Kalau muncul "can't be opened", buka **System Settings → Privacy & Security** → **Open Anyway**.

Ctas nggak muncul di Dock. Ikonnya ada di menu bar, dan overlay pecutnya langsung muncul sekali waktu app dibuka.

## Develop

Butuh Node 22+ dan Rust stable.

```sh
npm install
npm run dev        # app desktop, hot reload
npm run web        # landing page + demo di http://localhost:3000
npm run build:mac  # .app + .dmg universal (Apple Silicon + Intel)
```

Struktur:

```
src/                 frontend (HTML/CSS/JS polos, tanpa bundler)
  js/physics.js      simulasi tali Verlet
  js/audio.js        sintesis suara
  js/variants.js     parameter tiap varian + omelan si AI
  js/stage.js        render, input, deteksi ctarr (dipakai app & landing)
  js/main.js         UI app + jembatan ke Tauri
web/                 landing page (Vercel)
src-tauri/           shell desktop (Tauri 2)
  src/lib.rs         overlay, shortcut global, menu bar
  src/nag.rs         ngetik omelan ke app lain (macOS, AppleScript)
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
- `pitch`: nada suara ctarr

## Roadmap

- [ ] Windows & Linux (shell-nya udah jalan, tinggal fitur ngetik omelan)
- [ ] Varian lain: sapu lidi, sandal jepit, kabel charger
- [ ] Rekam suara pecut asli sebagai opsi
- [ ] Haptic trackpad pas CTARR
