//! Baca status tombol kiri mouse secara global (buat mode "klik = pecut").
//! Cuma baca status tombol, nggak nyadap event, jadi nggak butuh izin apa pun.

#[cfg(target_os = "macos")]
pub fn left_down() -> bool {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceButtonState(state_id: i32, button: u32) -> bool;
    }
    // kCGEventSourceStateCombinedSessionState = 0, kCGMouseButtonLeft = 0
    unsafe { CGEventSourceButtonState(0, 0) }
}

#[cfg(target_os = "windows")]
pub fn left_down() -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON};
    unsafe { (GetAsyncKeyState(VK_LBUTTON as i32) as u16 & 0x8000) != 0 }
}

/// Linux: belum ada cara simpel yang nggak butuh library X11 tambahan.
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn left_down() -> bool {
    false
}

/// Ngubah status tombol jadi event klik / double klik.
pub struct Clicks {
    down: bool,
    last: Option<(std::time::Instant, f64, f64)>,
}

impl Clicks {
    pub fn new() -> Self {
        Self { down: left_down(), last: None }
    }

    /// Balikin `Some(1)` buat klik, `Some(2)` buat klik kedua yang cepat & deket (double).
    pub fn poll(&mut self, x: f64, y: f64) -> Option<u8> {
        let now_down = left_down();
        let pressed = now_down && !self.down;
        self.down = now_down;
        if !pressed {
            return None;
        }
        let now = std::time::Instant::now();
        let double = matches!(self.last, Some((t, lx, ly))
            if now.duration_since(t).as_millis() < 380 && (x - lx).hypot(y - ly) < 40.0);
        self.last = if double { None } else { Some((now, x, y)) };
        Some(if double { 2 } else { 1 })
    }
}
