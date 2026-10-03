# Ctas

Pecut virtual di layar. Ayun mouse, sentak, ctarr. Jalan di macOS, Windows, dan Linux.

**[Download](https://github.com/nannndev/ctass/releases/latest)** · Gratis

## Pakai

1. Buka Ctas, pilih pecut, klik **Mulai mecut**.
2. Ayun mouse terus balik arah mendadak. Ctarr.
3. Udahan: **⌘⇧X** (Mac) / **Ctrl+Alt+X** (Windows, Linux), atau Esc.

Overlay-nya tembus klik, jadi layar tetap bisa dipakai biasa. Jendela Ctas ada di menu bar / system tray.

## Install

| OS | File |
| --- | --- |
| macOS 11+ | `Ctas-macOS.dmg` |
| Windows 10/11 | `Ctas-Windows-setup.exe` |
| Linux x64 (X11) | `Ctas-Linux.AppImage` / `.deb` |

- **macOS:** kalau dibilang "rusak", jalanin `xattr -cr /Applications/Ctas.app`.
- **Windows:** kalau muncul SmartScreen, klik **More info → Run anyway**.

Setelah ke-install, update berikutnya otomatis dari dalam app.

## Develop

Butuh Node 22+ dan Rust stable.

```sh
npm install
npm run dev   # app desktop
npm run web   # landing page di localhost:3000
```

Rilis: naikin `version` di `src-tauri/tauri.conf.json`, push ke `main`. CI yang build dan bikin release.

## Kredit

Rekaman cambuk dan ayunan dari [Pixabay](https://pixabay.com) (Universfield, freesound_community).
