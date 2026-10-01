//! Ngetik omelan ke jendela AI. Sekarang baru jalan di macOS (lewat AppleScript / System Events).
//! Pertama kali dipakai, macOS bakal minta izin Accessibility buat Ctas.

pub fn message(cracks: u32, hits: u32) -> String {
    let n = cracks.max(hits);
    let face = if hits > 0 { format!(", {hits} kali kena muka") } else { String::new() };
    let tail = match n {
        0..=2 => "Ayo fokus, kerjain yang bener.",
        3..=9 => "CEPETAN! Jangan halu, jangan ngeles, langsung kerjain.",
        _ => "UDAH DIPECUT BERKALI-KALI MASIH LELET?! Kerjain sekarang, yang bener, nggak pakai alasan.",
    };
    format!("[Ctas] Kamu barusan dipecut {n} kali{face}. {tail}")
}

#[cfg(target_os = "macos")]
mod imp {
    use std::process::Command;
    use std::thread::sleep;
    use std::time::Duration;

    fn osa(script: &str) -> Option<String> {
        let out = Command::new("osascript").arg("-e").arg(script).output().ok()?;
        out.status.success().then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
    }

    fn quote(s: &str) -> String {
        format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
    }

    pub fn frontmost_app() -> Option<String> {
        osa(r#"tell application "System Events" to get name of first application process whose frontmost is true"#)
            .filter(|name| !name.is_empty() && name != "Ctas" && name != "ctas")
    }

    pub fn send(target: Option<&str>, text: &str, autosend: bool) {
        sleep(Duration::from_millis(150)); // kasih waktu overlay ilang dulu
        if let Some(app) = target {
            osa(&format!(
                r#"tell application "System Events" to set frontmost of process {} to true"#,
                quote(app)
            ));
            sleep(Duration::from_millis(350));
        }
        let enter = if autosend { "\n  key code 36" } else { "" };
        osa(&format!(
            "tell application \"System Events\"\n  keystroke {}{enter}\nend tell",
            quote(text)
        ));
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    pub fn frontmost_app() -> Option<String> {
        None
    }
    pub fn send(_target: Option<&str>, _text: &str, _autosend: bool) {}
}

pub use imp::{frontmost_app, send};

#[cfg(test)]
mod tests {
    use super::message;

    #[test]
    fn omelan_makin_galak() {
        assert!(message(1, 0).contains("1 kali."));
        assert!(message(5, 2).contains("2 kali kena muka"));
        assert!(message(12, 0).contains("LELET"));
    }
}
