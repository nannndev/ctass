//! Ngetik omelan ke jendela yang lagi aktif.
//!
//! Overlay Ctas nggak pernah ngambil fokus, jadi jendela AI tetap aktif selama dipecut.
//! Pas udahan, omelan tinggal "diketik" ke sana pakai event keyboard sistem.
//! macOS: butuh izin Accessibility, dan izin itu cuma diminta waktu fitur ini dinyalain.

pub fn message(cracks: u32, hits: u32) -> String {
    let n = cracks.max(hits);
    let face = if hits > 0 { format!(", {hits} kali kena muka") } else { String::new() };
    let tail = match n {
        0..=2 => "Fokus ya, kerjain yang bener.",
        3..=9 => "Cepetan dong, jangan halu, langsung kerjain.",
        _ => "Udah dipecut berkali-kali masih lelet juga? Kerjain sekarang, nggak pakai alasan.",
    };
    format!("[Ctas] Kamu barusan dipecut {n} kali{face}. {tail}")
}

#[cfg(target_os = "macos")]
mod imp {
    use core_foundation::base::TCFType;
    use core_foundation::boolean::CFBoolean;
    use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
    use core_foundation::string::{CFString, CFStringRef};
    use core_graphics::event::{CGEvent, CGEventTapLocation};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    use std::thread::sleep;
    use std::time::Duration;

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> bool;
        static kAXTrustedCheckOptionPrompt: CFStringRef;
    }

    /// Cek izin Accessibility. Kalau `prompt`, macOS munculin dialog izinnya.
    pub fn permitted(prompt: bool) -> bool {
        unsafe {
            let key = CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt);
            let value = if prompt { CFBoolean::true_value() } else { CFBoolean::false_value() };
            let opts = CFDictionary::from_CFType_pairs(&[(key.as_CFType(), value.as_CFType())]);
            AXIsProcessTrustedWithOptions(opts.as_concrete_TypeRef())
        }
    }

    fn key(src: &CGEventSource, code: u16, text: Option<&str>) {
        for down in [true, false] {
            if let Ok(ev) = CGEvent::new_keyboard_event(src.clone(), code, down) {
                if let Some(t) = text {
                    ev.set_string(t);
                }
                ev.post(CGEventTapLocation::HID);
            }
        }
    }

    pub fn send(text: &str, autosend: bool) {
        if !permitted(false) {
            return;
        }
        let Ok(src) = CGEventSource::new(CGEventSourceStateID::HIDSystemState) else { return };
        // diketik per potongan kecil, beberapa app suka nelen string yang kepanjangan
        let chars: Vec<char> = text.chars().collect();
        for chunk in chars.chunks(16) {
            let s: String = chunk.iter().collect();
            key(&src, 0, Some(&s));
            sleep(Duration::from_millis(8));
        }
        if autosend {
            sleep(Duration::from_millis(60));
            key(&src, 36, None); // Return
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    pub fn permitted(_prompt: bool) -> bool {
        false
    }
    pub fn send(_text: &str, _autosend: bool) {}
}

pub use imp::{permitted, send};

#[cfg(test)]
mod tests {
    use super::message;

    #[test]
    fn omelan_makin_galak() {
        assert!(message(1, 0).contains("1 kali."));
        assert!(message(5, 2).contains("2 kali kena muka"));
        assert!(message(12, 0).contains("lelet"));
    }
}
