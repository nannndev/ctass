//! Ctas: overlay transparan di atas layar buat mecut AI.
//!
//! Ada dua jendela:
//! - `panel`: jendela Ctas biasa buat milih & ngustom pecut, nyobain, terus mulai.
//! - `main`: overlay transparan nutupin layar. Tembus klik dan nggak ngambil fokus,
//!   jadi lu tetap bisa klik & ngetik kayak biasa; pecutnya cuma nempel di kursor.
//!
//! Alurnya: ⌘⇧X (Ctrl+Alt+X di Windows/Linux) buat mulai, sentak mouse buat ctarr,
//! shortcut yang sama buat udahan.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::Wry;
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_updater::{Update, UpdaterExt};

mod mouse;

struct Ctas {
    /// Pengaturan dari jendela Ctas (pecut, custom, tampilan). Disimpan ke settings.json.
    settings: Mutex<Value>,
    /// Thread pembaca posisi kursor lagi jalan.
    tracking: Arc<AtomicBool>,
    /// Item menu tray, biar teksnya bisa ganti bahasa.
    tray_items: Mutex<Vec<MenuItem<Wry>>>,
    /// Update yang ketemu pas dicek, nunggu diinstall.
    update: Mutex<Option<Update>>,
}

fn setting_lang(app: &AppHandle) -> String {
    let lang = app.state::<Ctas>().settings.lock().unwrap().get("lang").and_then(Value::as_str).map(str::to_owned);
    lang.filter(|l| l == "en" || l == "id").unwrap_or_else(|| "id".into())
}

fn tray_texts(lang: &str) -> [String; 4] {
    let key = if cfg!(target_os = "macos") { "⌘⇧X" } else { "Ctrl+Alt+X" };
    let version = env!("CARGO_PKG_VERSION");
    if lang == "en" {
        ["Open Ctas (pick & tweak whips)".into(), format!("Start / stop whipping   {key}"), format!("Check for updates (v{version})"), "Quit".into()]
    } else {
        ["Buka Ctas (pilih & atur pecut)".into(), format!("Mulai / udahan mecut   {key}"), format!("Cek update (v{version})"), "Keluar".into()]
    }
}

fn update_tray(app: &AppHandle) {
    let texts = tray_texts(&setting_lang(app));
    for (item, text) in app.state::<Ctas>().tray_items.lock().unwrap().iter().zip(texts) {
        let _ = item.set_text(text);
    }
}

fn settings_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("settings.json"))
}

fn load_settings(app: &AppHandle) -> Value {
    settings_path(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| json!({}))
}

fn toggle(app: &AppHandle) {
    let Some(w) = app.get_webview_window("main") else { return };
    if w.is_visible().unwrap_or(false) {
        // minta frontend nutup, biar skor sesi ikut dikirim balik lewat `dismiss`
        let _ = w.emit("ctas://request-dismiss", ());
    } else {
        activate(app);
    }
}

fn activate(app: &AppHandle) {
    let Some(w) = app.get_webview_window("main") else { return };

    // tutupin monitor tempat kursor lagi berada
    let monitor = app
        .cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| w.primary_monitor().ok().flatten());
    if let Some(m) = &monitor {
        let _ = w.set_position(*m.position());
        let _ = w.set_size(*m.size());
    }
    let _ = w.set_ignore_cursor_events(true);
    let _ = w.show();
    let _ = w.emit("ctas://activated", ());
    track_cursor(app);
}

fn open_panel(app: &AppHandle) {
    if let Some(p) = app.get_webview_window("panel") {
        let _ = p.show();
        let _ = p.unminimize();
        let _ = p.set_focus();
    }
}

/// Window tembus klik nggak dapet event mouse, jadi posisi kursor dibaca dari sistem
/// (~150x per detik) dan dikirim ke frontend dalam koordinat window.
fn track_cursor(app: &AppHandle) {
    let tracking = app.state::<Ctas>().tracking.clone();
    if tracking.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let Some(w) = app.get_webview_window("main") else { return };
        // timer bawaan Windows kasar (~15 ms), sentakan jadi kebaca patah-patah.
        // Minta resolusi 1 ms selama mecut.
        #[cfg(target_os = "windows")]
        unsafe {
            windows_sys::Win32::Media::timeBeginPeriod(1);
        }
        let mut last = (f64::NAN, f64::NAN);
        let mut clicks = mouse::Clicks::new();
        // monitor yang lagi ditutupin overlay (diidentifikasi dari posisinya)
        let monitor_at = |x: f64, y: f64| app.monitor_from_point(x, y).ok().flatten();
        let mut screen = app.cursor_position().ok().and_then(|p| monitor_at(p.x, p.y)).map(|m| *m.position());
        let mut tick = 0u32;
        while tracking.load(Ordering::SeqCst) {
            tick = tick.wrapping_add(1);
            // banyak monitor: kursor pindah layar = overlay ikut pindah ke layar itu (dicek ~tiap 50 ms)
            if tick % 8 == 0 {
                if let Some(m) = app.cursor_position().ok().and_then(|p| monitor_at(p.x, p.y)) {
                    if Some(*m.position()) != screen {
                        screen = Some(*m.position());
                        let _ = w.set_position(*m.position());
                        let _ = w.set_size(*m.size());
                        let _ = w.emit("ctas://monitor", ());
                        last = (f64::NAN, f64::NAN);
                    }
                }
            }
            if let (Ok(p), Ok(origin), Ok(scale)) = (app.cursor_position(), w.outer_position(), w.scale_factor()) {
                let x = (p.x - origin.x as f64) / scale;
                let y = (p.y - origin.y as f64) / scale;
                if (x, y) != last {
                    last = (x, y);
                    let _ = w.emit("ctas://cursor", (x, y));
                }
                // mode klik: klik / double klik di mana aja = pecut nyabet ke situ
                match clicks.poll(x, y) {
                    Some(mouse::Press::Down(n)) => { let _ = w.emit("ctas://click", (x, y, n)); }
                    Some(mouse::Press::Up) => { let _ = w.emit("ctas://release", (x, y)); }
                    None => {}
                }
            }
            std::thread::sleep(Duration::from_millis(6));
        }
        #[cfg(target_os = "windows")]
        unsafe {
            windows_sys::Win32::Media::timeEndPeriod(1);
        }
    });
}

#[tauri::command]
fn dismiss(app: AppHandle, state: State<'_, Ctas>) {
    state.tracking.store(false, Ordering::SeqCst);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}

/// Matiin tembus klik sementara (dipakai kalau suara butuh satu klik buat nyala).
#[tauri::command]
fn set_passthrough(app: AppHandle, on: bool) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_ignore_cursor_events(on);
    }
}

#[tauri::command]
fn get_settings(state: State<'_, Ctas>) -> Value {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(app: AppHandle, state: State<'_, Ctas>, settings: Value) {
    *state.settings.lock().unwrap() = settings.clone();
    if let Some(path) = settings_path(&app) {
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(path, serde_json::to_string_pretty(&settings).unwrap_or_default());
    }
    let _ = app.emit("ctas://settings", settings);
    update_tray(&app);
}

/// Tombol "Mulai mecut" di jendela Ctas: sembunyiin jendelanya dulu biar fokus balik
/// ke app sebelumnya (jendela AI), baru overlay dimunculin.
#[tauri::command]
fn start(app: AppHandle) {
    if let Some(p) = app.get_webview_window("panel") {
        let _ = p.hide();
    }
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(200));
        activate(&app);
    });
}

// ---------- suara sendiri ----------
// File audio dari user disimpan di <config>/sounds/<id>. id dibikin frontend
// (hex acak + ekstensi), dicek di sini biar nggak bisa nulis ke luar folder.

fn sound_path(app: &AppHandle, id: &str) -> Result<std::path::PathBuf, String> {
    let ok = !id.is_empty() && id.len() <= 40 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '.') && !id.starts_with('.');
    if !ok {
        return Err("id suara nggak valid".into());
    }
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?.join("sounds");
    Ok(dir.join(id))
}

const MAX_SOUND_BYTES: usize = 8 * 1024 * 1024;

#[tauri::command]
fn save_sound(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let id = request.headers().get("x-sound-id").and_then(|v| v.to_str().ok()).ok_or("id suara kosong")?;
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else { return Err("isi file kosong".into()) };
    if bytes.len() > MAX_SOUND_BYTES {
        return Err("file kegedean".into());
    }
    let path = sound_path(&app, id)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_sound(app: AppHandle, id: String) -> Result<tauri::ipc::Response, String> {
    let bytes = std::fs::read(sound_path(&app, &id)?).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn delete_sound(app: AppHandle, id: String) -> Result<(), String> {
    let _ = std::fs::remove_file(sound_path(&app, &id)?);
    Ok(())
}

/// Cek versi baru di GitHub Releases. Balikin nomor versinya kalau ada.
#[tauri::command]
async fn check_update(app: AppHandle) -> Result<Option<String>, String> {
    let found = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
    let version = found.as_ref().map(|u| u.version.clone());
    *app.state::<Ctas>().update.lock().unwrap() = found;
    Ok(version)
}

/// Download + install update yang tadi ketemu, terus buka ulang Ctas.
#[tauri::command]
async fn install_update(app: AppHandle) -> Result<(), String> {
    let update = app.state::<Ctas>().update.lock().unwrap().take();
    let Some(update) = update else { return Err("nggak ada update".into()) };
    let progress = app.clone();
    let mut done = 0u64;
    update
        .download_and_install(
            move |chunk, total| {
                done += chunk as u64;
                let _ = progress.emit("ctas://update-progress", (done, total));
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    app.restart()
}

pub fn run() {
    tauri::Builder::default()
        // buka Ctas lagi (Start Menu, Launchpad, dll) pas udah jalan = munculin jendela yang lama
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| open_panel(app)))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Ctas {
            settings: Mutex::new(json!({})),
            tracking: Arc::new(AtomicBool::new(false)),
            tray_items: Mutex::new(Vec::new()),
            update: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![dismiss, set_passthrough, get_settings, save_settings, start, check_update, install_update, save_sound, load_sound, delete_sound])
        .on_window_event(|window, event| {
            // nutup jendela Ctas = sembunyiin aja, app tetap jalan di menu bar / tray
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "panel" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory); // nggak nongol di Dock

            *app.state::<Ctas>().settings.lock().unwrap() = load_settings(app.handle());

            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focusable(false); // jendela AI tetap pegang fokus keyboard
            }

            // shortcut global
            // Ctrl+Shift+X di Windows/Linux kepake buat Extensions di VS Code & kawan-kawan
            let mods = if cfg!(target_os = "macos") { Modifiers::SUPER | Modifiers::SHIFT } else { Modifiers::CONTROL | Modifiers::ALT };
            let shortcut = Shortcut::new(Some(mods), Code::KeyX);
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, s, e| {
                        if s == &shortcut && e.state() == ShortcutState::Pressed {
                            toggle(app);
                        }
                    })
                    .build(),
            )?;
            app.global_shortcut().register(shortcut)?;

            // ikon di menu bar / system tray
            let [t_open, t_start, t_update, t_quit] = tray_texts(&setting_lang(app.handle()));
            let open = MenuItem::with_id(app, "open", t_open, true, None::<&str>)?;
            let start = MenuItem::with_id(app, "toggle", t_start, true, None::<&str>)?;
            let update = MenuItem::with_id(app, "update", t_update, true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", t_quit, true, None::<&str>)?;
            *app.state::<Ctas>().tray_items.lock().unwrap() = vec![open.clone(), start.clone(), update.clone(), quit.clone()];
            let menu = Menu::with_items(app, &[&open, &start, &PredefinedMenuItem::separator(app)?, &update, &quit])?;
            let mut tray = TrayIconBuilder::with_id("ctas")
                .tooltip("Ctas")
                .menu(&menu)
                .show_menu_on_left_click(cfg!(target_os = "macos"))
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => open_panel(app),
                    "toggle" => toggle(app),
                    "update" => {
                        open_panel(app);
                        if let Some(p) = app.get_webview_window("panel") {
                            let _ = p.emit("ctas://check-update", ());
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                // Windows/Linux: klik kiri ikon tray langsung buka jendela Ctas
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        if !cfg!(target_os = "macos") {
                            open_panel(tray.app_handle());
                        }
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            // pertama dibuka: tunjukin jendela Ctas
            open_panel(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("gagal menjalankan Ctas");
}
