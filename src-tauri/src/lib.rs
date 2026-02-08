#[derive(serde::Serialize)]
struct EditorFontSelection {
    #[serde(rename = "fontFamily")]
    font_family: String,
    #[serde(rename = "fontSize")]
    font_size: f64,
    #[serde(rename = "fontStyle")]
    font_style: String,
    #[serde(rename = "fontWeight")]
    font_weight: i32,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct EditorFontInput {
    font_family: String,
    font_size: f64,
    font_style: String,
    font_weight: i32,
}

fn to_pango_style(value: &str) -> gtk::pango::Style {
    match value {
        "italic" => gtk::pango::Style::Italic,
        "oblique" => gtk::pango::Style::Oblique,
        _ => gtk::pango::Style::Normal,
    }
}

fn to_pango_weight(value: i32) -> gtk::pango::Weight {
    match value {
        ..=149 => gtk::pango::Weight::Thin,
        150..=249 => gtk::pango::Weight::Ultralight,
        250..=324 => gtk::pango::Weight::Light,
        325..=374 => gtk::pango::Weight::Book,
        375..=474 => gtk::pango::Weight::Normal,
        475..=549 => gtk::pango::Weight::Medium,
        550..=649 => gtk::pango::Weight::Semibold,
        650..=774 => gtk::pango::Weight::Bold,
        775..=849 => gtk::pango::Weight::Ultrabold,
        _ => gtk::pango::Weight::Heavy,
    }
}

fn px_to_pango_size(px: f64) -> i32 {
    (px.max(1.0) * gtk::pango::SCALE as f64).round() as i32
}

fn pango_size_to_px(description: &gtk::pango::FontDescription) -> f64 {
    if description.size() <= 0 {
        return 14.0;
    }
    description.size() as f64 / gtk::pango::SCALE as f64
}

#[tauri::command]
fn choose_editor_font(
    app: tauri::AppHandle,
    current: Option<EditorFontInput>,
) -> Result<Option<EditorFontSelection>, String> {
    #[cfg(target_os = "linux")]
    {
        use gtk::glib::translate::IntoGlib;
        use gtk::prelude::*;
        use std::sync::mpsc;

        let (tx, rx) = mpsc::channel::<Option<EditorFontSelection>>();

        app.run_on_main_thread(move || {
            if !gtk::is_initialized() {
                if let Err(error) = gtk::init() {
                    eprintln!("[wisty-font] gtk init failed: {}", error);
                    let _ = tx.send(None);
                    return;
                }
            }

            let dialog =
                gtk::FontChooserDialog::new(Some("Choose Editor Font"), None::<&gtk::Window>);
            dialog.set_modal(true);

            if let Some(current_font) = current {
                let mut description = gtk::pango::FontDescription::new();
                description.set_family(&current_font.font_family);
                description.set_style(to_pango_style(&current_font.font_style));
                description.set_weight(to_pango_weight(current_font.font_weight));
                description.set_size(px_to_pango_size(current_font.font_size.clamp(9.0, 40.0)));
                dialog.set_font_desc(&description);
            }

            let response = dialog.run();
            eprintln!("[wisty-font] dialog response: {:?}", response);

            let selected = if matches!(
                response,
                gtk::ResponseType::Accept | gtk::ResponseType::Ok | gtk::ResponseType::Yes
            ) {
                let description = dialog
                    .font_desc()
                    .unwrap_or_else(|| gtk::pango::FontDescription::from_string("Sans 11"));

                let family = description
                    .family()
                    .map(|value| value.to_string())
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| "Sans".to_string());

                let pixels = pango_size_to_px(&description).round();

                let style = match description.style() {
                    gtk::pango::Style::Italic => "italic",
                    gtk::pango::Style::Oblique => "oblique",
                    _ => "normal",
                };

                let selection = EditorFontSelection {
                    font_family: family,
                    font_size: pixels,
                    font_style: style.to_string(),
                    font_weight: description.weight().into_glib(),
                };

                eprintln!(
                    "[wisty-font] selected family='{}' size={} style={} weight={}",
                    selection.font_family,
                    selection.font_size,
                    selection.font_style,
                    selection.font_weight
                );

                Some(selection)
            } else {
                None
            };

            dialog.close();
            eprintln!("[wisty-font] returning selection: {}", selected.is_some());
            let _ = tx.send(selected);
        })
        .map_err(|error| error.to_string())?;

        return rx.recv().map_err(|error| error.to_string());
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = app;
        Ok(None)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![choose_editor_font])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
