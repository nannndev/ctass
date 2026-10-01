// Jangan munculin jendela konsol tambahan di Windows (build release).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ctas_lib::run()
}
