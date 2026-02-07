#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[cfg(target_os = "windows")]
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};
#[cfg(target_os = "windows")]
use window_shadows::set_shadow;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_log::Builder::new()
                .clear_targets()
                .target(Target::new(TargetKind::Stdout))
                .build(),
        )
        .setup(|_app| {
            #[cfg(target_os = "windows")]
            {
                let window = _app.get_webview_window("main").unwrap();
                set_shadow(&window, true).expect("Unsupported platform!");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
