//! Ctas: overlay transparan di atas layar buat mecut AI.
//!
//! Alurnya:
//! 1. Tekan ⌘⇧X (Ctrl+Shift+X di Windows/Linux). Overlay muncul nutupin layar, tapi
//!    tembus klik dan nggak ngambil fokus: lu tetap bisa klik & ngetik kayak biasa,
//!    pecutnya cuma nempel di kursor.
//! 2. Sentak mouse buat ctarr.
//! 3. Tekan ⌘⇧X lagi buat udahan. Kalau fitur omelan nyala, omelan diketik ke
//!    jendela yang lagi aktif (jendela AI lu).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

mod nag;

const VARIANTS: [(&str, &str); 5] = [
    ("jaranan", "Jaranan"),
    ("sapi", "Cambuk sapi"),
    ("bullwhip", "Bullwhip"),
    ("samandiman", "Samandiman"),
    ("cemeti", "Cemeti"),
];

struct Ctas {
    /// Ketik omelan pas udahan. Default mati, biar nggak ada izin yang diminta di awal.
    nag: AtomicBool,
    /// Sekalian tekan Enter biar omelannya langsung kekirim.
    autosend: AtomicBool,
    /// Thread pembaca posisi kursor lagi jalan.
    tracking: Arc<AtomicBool>,
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

/// Window tembus klik nggak dapet event mouse, jadi posisi kursor dibaca dari sistem
/// (~120x per detik) dan dikirim ke frontend dalam koordinat window.
fn track_cursor(app: &AppHandle) {
    let tracking = app.state::<Ctas>().tracking.clone();
    if tracking.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let Some(w) = app.get_webview_window("main") else { return };
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
            std::thread::sleep(Duration::from_millis(8));
        }
    });
}

#[tauri::command]
fn dismiss(app: AppHandle, state: State<'_, Ctas>, cracks: u32, hits: u32) {
    state.tracking.store(false, Ordering::SeqCst);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    if !state.nag.load(Ordering::Relaxed) || cracks + hits == 0 {
        return;
    }
    let autosend = state.autosend.load(Ordering::Relaxed);
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

pub fn run() {
    tauri::Builder::default()
        .manage(Ctas {
            nag: AtomicBool::new(false),
            autosend: AtomicBool::new(false),
            tracking: Arc::new(AtomicBool::new(false)),
        })
        .invoke_handler(tauri::generate_handler![dismiss, set_passthrough])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory); // nggak nongol di Dock

            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focusable(false); // jendela AI tetap pegang fokus keyboard
            }

            // shortcut global
            let mods = if cfg!(target_os = "macos") { Modifiers::SUPER } else { Modifiers::CONTROL };
            let shortcut = Shortcut::new(Some(mods | Modifiers::SHIFT), Code::KeyX);
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

            // ikon di menu bar
            let key_hint = if cfg!(target_os = "macos") { "⌘⇧X" } else { "Ctrl+Shift+X" };
            let start = MenuItem::with_id(app, "toggle", format!("Mulai / udahan mecut   {key_hint}"), true, None::<&str>)?;
            let variant_items = VARIANTS
                .iter()
                .enumerate()
                .map(|(i, (k, name))| CheckMenuItem::with_id(app, format!("v:{k}"), *name, true, i == 0, None::<&str>))
                .collect::<tauri::Result<Vec<_>>>()?;
            let variant_refs: Vec<&dyn IsMenuItem<Wry>> = variant_items.iter().map(|i| i as &dyn IsMenuItem<Wry>).collect();
            let variants = Submenu::with_items(app, "Pecut", true, &variant_refs)?;
            let nag_item = CheckMenuItem::with_id(app, "nag", "Ketik omelan ke AI pas udahan", true, false, None::<&str>)?;
            let auto_item = CheckMenuItem::with_id(app, "autosend", "Langsung kirim (tekan Enter)", true, false, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &start,
                    &variants,
                    &PredefinedMenuItem::separator(app)?,
                    &nag_item,
                    &auto_item,
                    &PredefinedMenuItem::separator(app)?,
                    &quit,
                ],
            )?;
            let mut tray = TrayIconBuilder::with_id("ctas")
                .tooltip("Ctas")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(move |app, event| {
                    let id = event.id().as_ref();
                    match id {
                        "toggle" => toggle(app),
                        "nag" => {
                            let on = nag_item.is_checked().unwrap_or(false);
                            if on {
                                nag::permitted(true); // baru minta izin Accessibility di sini
                            }
                            app.state::<Ctas>().nag.store(on, Ordering::Relaxed);
                        }
                        "autosend" => app.state::<Ctas>().autosend.store(auto_item.is_checked().unwrap_or(false), Ordering::Relaxed),
                        "quit" => app.exit(0),
                        _ => {
                            if let Some(key) = id.strip_prefix("v:") {
                                for item in &variant_items {
                                    let _ = item.set_checked(item.id().as_ref() == id);
                                }
                                let _ = app.emit("ctas://variant", key);
                            }
                        }
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            // langsung tunjukin sekali waktu app dibuka
            activate(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("gagal menjalankan Ctas");
}
