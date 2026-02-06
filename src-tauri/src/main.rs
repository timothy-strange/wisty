#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[cfg(target_os = "windows")]
use window_shadows::set_shadow;

use tauri::Manager;
use tauri::{PhysicalPosition, PhysicalSize, Size};
use tauri_plugin_log::{Target, TargetKind};

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
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "windows")]
            {
                set_shadow(&window, true).expect("Unsupported platform!");
            }

            if let Ok(Some(monitor)) = window.current_monitor() {
                let monitor_size = monitor.size();
                let monitor_position = monitor.position();

                if let Ok(current_size) = window.inner_size() {
                    let height = ((monitor_size.height as f64) * 0.85).round() as u32;
                    let width = current_size.width;

                    let _ = window.set_size(Size::Physical(PhysicalSize { width, height }));

                    let y_offset = (monitor_size.height.saturating_sub(height)) / 2;
                    let x = window
                        .outer_position()
                        .map(|position| position.x)
                        .unwrap_or(monitor_position.x);
                    let y = monitor_position.y + y_offset as i32;

                    let _ = window.set_position(PhysicalPosition { x, y });
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
