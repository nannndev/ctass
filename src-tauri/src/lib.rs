//! Ctas: overlay transparan di atas layar buat mecut AI.
//!
//! Ada dua jendela:
//! - `panel`: jendela Ctas biasa buat milih & ngustom pecut, nyobain, terus mulai.
//! - `main`: overlay transparan nutupin layar. Tembus klik dan nggak ngambil fokus,
//!   jadi lu tetap bisa klik & ngetik kayak biasa; pecutnya cuma nempel di kursor.
//!
//! Alurnya: ⌘⇧X (Ctrl+Alt+X di Windows/Linux) buat mulai, sentak mouse buat ctarr,
//! shortcut yang sama buat udahan. Kalau fitur omelan nyala, omelan diketik ke jendela
//! yang lagi aktif (jendela AI lu).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

mod nag;

struct Ctas {
    /// Pengaturan dari jendela Ctas (pecut, custom, omelan). Disimpan ke settings.json.
    settings: Mutex<Value>,
    /// Thread pembaca posisi kursor lagi jalan.
    tracking: Arc<AtomicBool>,
}

fn setting_bool(app: &AppHandle, key: &str) -> bool {
    app.state::<Ctas>().settings.lock().unwrap().get(key).and_then(Value::as_bool).unwrap_or(false)
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
        while tracking.load(Ordering::SeqCst) {
            if let (Ok(p), Ok(origin), Ok(scale)) = (app.cursor_position(), w.outer_position(), w.scale_factor()) {
                let x = (p.x - origin.x as f64) / scale;
                let y = (p.y - origin.y as f64) / scale;
                if (x, y) != last {
                    last = (x, y);
                    let _ = w.emit("ctas://cursor", (x, y));
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
fn dismiss(app: AppHandle, state: State<'_, Ctas>, cracks: u32, hits: u32) {
    state.tracking.store(false, Ordering::SeqCst);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    if !setting_bool(&app, "nag") || cracks + hits == 0 {
        return;
    }
    let autosend = setting_bool(&app, "autosend");
    let text = nag::message(cracks, hits);
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(120)); // kasih waktu overlay ilang dulu
        nag::send(&text, autosend);
    });
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
    let nag_was_on = setting_bool(&app, "nag");
    let nag_on = settings.get("nag").and_then(Value::as_bool).unwrap_or(false);
    *state.settings.lock().unwrap() = settings.clone();
    if let Some(path) = settings_path(&app) {
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(path, serde_json::to_string_pretty(&settings).unwrap_or_default());
    }
    if nag_on && !nag_was_on {
        nag::permitted(true); // izin Accessibility (macOS) baru diminta di sini
    }
    let _ = app.emit("ctas://settings", settings);
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

pub fn run() {
    tauri::Builder::default()
        .manage(Ctas { settings: Mutex::new(json!({})), tracking: Arc::new(AtomicBool::new(false)) })
        .invoke_handler(tauri::generate_handler![dismiss, set_passthrough, get_settings, save_settings, start])
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
            let key_hint = if cfg!(target_os = "macos") { "⌘⇧X" } else { "Ctrl+Alt+X" };
            let open = MenuItem::with_id(app, "open", "Buka Ctas (pilih & atur pecut)", true, None::<&str>)?;
            let start = MenuItem::with_id(app, "toggle", format!("Mulai / udahan mecut   {key_hint}"), true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &start, &PredefinedMenuItem::separator(app)?, &quit])?;
            let mut tray = TrayIconBuilder::with_id("ctas")
                .tooltip("Ctas")
                .menu(&menu)
                .show_menu_on_left_click(cfg!(target_os = "macos"))
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => open_panel(app),
                    "toggle" => toggle(app),
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
