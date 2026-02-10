use log::LevelFilter;
use serde::Serialize;
use std::io::ErrorKind;
use std::io::{IsTerminal, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const CLI_SOFT_LIMIT_BYTES: u64 = 50 * 1024 * 1024;
const CLI_HARD_LIMIT_BYTES: u64 = 1024 * 1024 * 1024;

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchFileArg {
    path: String,
    exists: bool,
    text: Option<String>,
}

struct LaunchArgState {
    pending_file: Mutex<Option<LaunchFileArg>>,
}

impl LaunchArgState {
    fn new(pending_file: Option<LaunchFileArg>) -> Self {
        Self {
            pending_file: Mutex::new(pending_file),
        }
    }
}

fn parse_positional_launch_args() -> Result<Option<String>, String> {
    let mut positional: Vec<String> = Vec::new();
    let mut passthrough_mode = false;

    for arg in std::env::args().skip(1) {
        if !passthrough_mode && arg == "--" {
            passthrough_mode = true;
            continue;
        }
        if !passthrough_mode && arg.starts_with('-') {
            continue;
        }
        positional.push(arg);
    }

    if positional.len() > 1 {
        return Err("Only one file path argument is supported".to_string());
    }

    Ok(positional.into_iter().next())
}

fn normalize_cli_path(raw: &str) -> Result<PathBuf, String> {
    if raw.trim().is_empty() {
        return Err("Empty file path argument".to_string());
    }

    let maybe_file_uri = raw.strip_prefix("file://");
    let path = if let Some(uri_path) = maybe_file_uri {
        if uri_path.is_empty() {
            return Err("Invalid file:// path argument".to_string());
        }
        #[cfg(windows)]
        {
            let normalized = uri_path.strip_prefix('/').unwrap_or(uri_path);
            PathBuf::from(normalized)
        }
        #[cfg(not(windows))]
        {
            PathBuf::from(uri_path)
        }
    } else {
        PathBuf::from(raw)
    };

    if path.is_absolute() {
        return Ok(path);
    }

    let cwd = std::env::current_dir()
        .map_err(|error| format!("Unable to determine current directory: {error}"))?;
    Ok(cwd.join(path))
}

fn is_interactive_tty() -> bool {
    std::io::stdin().is_terminal() && std::io::stdout().is_terminal()
}

fn format_size_mb(size_bytes: u64) -> String {
    format!("{:.1}", size_bytes as f64 / (1024.0 * 1024.0))
}

fn confirm_large_cli_open(path: &Path, size_bytes: u64) -> Result<(), String> {
    if size_bytes < CLI_SOFT_LIMIT_BYTES {
        return Ok(());
    }

    if size_bytes >= CLI_HARD_LIMIT_BYTES {
        return Err(format!(
            "File is too large to open safely ({} MB, hard limit is {} MB): {}",
            format_size_mb(size_bytes),
            format_size_mb(CLI_HARD_LIMIT_BYTES),
            path.to_string_lossy()
        ));
    }

    if !is_interactive_tty() {
        return Err(format!(
            "File is large ({} MB). Run from an interactive terminal to confirm opening: {}",
            format_size_mb(size_bytes),
            path.to_string_lossy()
        ));
    }

    eprintln!(
        "wisty: warning: '{}' is a large file ({} MB).",
        path.to_string_lossy(),
        format_size_mb(size_bytes)
    );
    eprint!("Open anyway? [y/N] ");
    std::io::stderr()
        .flush()
        .map_err(|error| format!("Unable to prompt for confirmation: {error}"))?;

    let mut input = String::new();
    std::io::stdin()
        .read_line(&mut input)
        .map_err(|error| format!("Unable to read confirmation input: {error}"))?;

    let answer = input.trim().to_ascii_lowercase();
    if answer == "y" || answer == "yes" {
        return Ok(());
    }

    Err(format!(
        "Opening cancelled for large file: {}",
        path.to_string_lossy()
    ))
}

fn validate_launch_file_arg(path: &Path) -> Result<LaunchFileArg, String> {
    match std::fs::metadata(path) {
        Ok(metadata) => {
            if !metadata.is_file() {
                return Err(format!("Path is not a regular file: {}", path.to_string_lossy()));
            }
            confirm_large_cli_open(path, metadata.len())?;
            let canonical_path = std::fs::canonicalize(path)
                .map_err(|error| format!("Unable to normalize file path '{}': {error}", path.to_string_lossy()))?;
            let text = std::fs::read_to_string(&canonical_path)
                .map_err(|error| format!("Unable to read file '{}': {error}", canonical_path.to_string_lossy()))?;

            Ok(LaunchFileArg {
                path: canonical_path.to_string_lossy().to_string(),
                exists: true,
                text: Some(text),
            })
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {
            let parent = path.parent().ok_or_else(|| {
                format!(
                    "Cannot determine parent directory for '{}'",
                    path.to_string_lossy()
                )
            })?;

            if !parent.exists() {
                return Err(format!(
                    "Parent directory does not exist for '{}'",
                    path.to_string_lossy()
                ));
            }

            if !parent.is_dir() {
                return Err(format!(
                    "Parent path is not a directory for '{}'",
                    path.to_string_lossy()
                ));
            }

            let canonical_parent = std::fs::canonicalize(parent).map_err(|error| {
                format!(
                    "Unable to normalize parent directory for '{}': {error}",
                    path.to_string_lossy()
                )
            })?;
            let file_name = path.file_name().ok_or_else(|| {
                format!(
                    "Cannot determine file name for '{}'",
                    path.to_string_lossy()
                )
            })?;
            let normalized_path = canonical_parent.join(file_name);

            Ok(LaunchFileArg {
                path: normalized_path.to_string_lossy().to_string(),
                exists: false,
                text: None,
            })
        }
        Err(error) => Err(format!(
            "Unable to access '{}': {error}",
            path.to_string_lossy()
        )),
    }
}

fn resolve_launch_file_arg() -> Result<Option<LaunchFileArg>, String> {
    let raw = parse_positional_launch_args()?;
    let Some(raw_path) = raw else {
        return Ok(None);
    };

    let normalized = normalize_cli_path(&raw_path)?;
    validate_launch_file_arg(&normalized).map(Some)
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
                if let Err(_error) = gtk::init() {
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

                Some(selection)
            } else {
                None
            };

            dialog.close();
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

#[tauri::command]
fn take_launch_file_arg(
    state: tauri::State<'_, LaunchArgState>,
) -> Result<Option<LaunchFileArg>, String> {
    let mut guard = state
        .pending_file
        .lock()
        .map_err(|error| format!("Unable to read launch args state: {error}"))?;

    if let Some(launch_file) = guard.as_ref() {
        if launch_file.exists && launch_file.text.is_none() {
            return Err(format!(
                "Invalid startup payload: existing file has no text: {}",
                launch_file.path
            ));
        }
    }

    Ok(guard.take())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launch_file = match resolve_launch_file_arg() {
        Ok(value) => value,
        Err(error) => {
            eprintln!("wisty: {error}");
            std::process::exit(1);
        }
    };

    let is_debug_build = cfg!(debug_assertions);
    let log_plugin = tauri_plugin_log::Builder::new()
        .level(if is_debug_build {
            LevelFilter::Info
        } else {
            LevelFilter::Warn
        })
        .level_for("arboard", LevelFilter::Warn)
        .level_for("arboard::platform::linux::x11", LevelFilter::Warn)
        .filter(move |metadata| {
            if is_debug_build {
                return true;
            }
            metadata.target().starts_with("wisty::")
        })
        .build();

    tauri::Builder::default()
        .manage(LaunchArgState::new(launch_file))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(log_plugin)
        .invoke_handler(tauri::generate_handler![
            choose_editor_font,
            take_launch_file_arg,
            window_title::set_window_title
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
mod window_title;
