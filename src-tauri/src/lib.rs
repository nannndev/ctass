//! Ctas: overlay transparen di atas layar buat mecut AI.
//!
//! Alurnya:
//! 1. Tekan ⌘⇧X (Ctrl+Shift+X di Windows/Linux) -> app nyatet jendela yang lagi aktif
//!    (misalnya Claude / ChatGPT / terminal), terus overlay pecut muncul nutupin layar.
//! 2. Pecut sepuasnya.
//! 3. Tekan Esc / ⌘⇧X lagi -> overlay ilang, fokus balik ke jendela AI tadi,
//!    dan omelan diketik ke sana (macOS, butuh izin Accessibility).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

mod nag;

struct Ctas {
    /// Aplikasi yang aktif sebelum overlay muncul (target omelan).
    prev_app: Mutex<Option<String>>,
    /// Ketik omelan ke AI waktu udahan.
    nag: AtomicBool,
    /// Sekalian tekan Enter biar omelannya langsung kekirim.
    autosend: AtomicBool,
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
    *app.state::<Ctas>().prev_app.lock().unwrap() = nag::frontmost_app();

    // tutupin monitor tempat kursor lagi berada
    let monitor = app
        .cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| w.primary_monitor().ok().flatten());
    if let Some(m) = monitor {
        let _ = w.set_position(*m.position());
        let _ = w.set_size(*m.size());
    }
    let _ = w.show();
    let _ = w.set_focus();
    let _ = w.emit("ctas://activated", ());
}

#[tauri::command]
fn dismiss(app: AppHandle, state: State<'_, Ctas>, cracks: u32, hits: u32) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    if !state.nag.load(Ordering::Relaxed) || cracks + hits == 0 {
        return;
    }
    let target = state.prev_app.lock().unwrap().clone();
    let autosend = state.autosend.load(Ordering::Relaxed);
    let text = nag::message(cracks, hits);
    std::thread::spawn(move || nag::send(target.as_deref(), &text, autosend));
}

pub fn run() {
    tauri::Builder::default()
        .manage(Ctas {
            prev_app: Mutex::new(None),
            nag: AtomicBool::new(true),
            autosend: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![dismiss])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory); // nggak nongol di Dock

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
            let start = MenuItem::with_id(app, "toggle", format!("Mulai mecut ({key_hint})"), true, None::<&str>)?;
            let nag_item = CheckMenuItem::with_id(app, "nag", "Ketik omelan ke AI pas udahan", true, true, None::<&str>)?;
            let auto_item = CheckMenuItem::with_id(app, "autosend", "Langsung kirim (tekan Enter)", true, false, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &start,
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
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "toggle" => toggle(app),
                    "nag" => app.state::<Ctas>().nag.store(nag_item.is_checked().unwrap_or(true), Ordering::Relaxed),
                    "autosend" => app.state::<Ctas>().autosend.store(auto_item.is_checked().unwrap_or(false), Ordering::Relaxed),
                    "quit" => app.exit(0),
                    _ => {}
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
