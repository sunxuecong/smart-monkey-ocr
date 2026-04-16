use base64::Engine;
use std::sync::Mutex;
use tauri::Emitter;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_global_shortcut::ShortcutState;

#[allow(dead_code)]
struct ScreenshotCache(Mutex<Option<String>>);

// --- macOS: use native screencapture ---

#[cfg(target_os = "macos")]
#[tauri::command]
fn screenshot_region() -> Result<String, String> {
    let temp_path = "/tmp/tauri_screenshot_region.png";
    let status = std::process::Command::new("screencapture")
        .args(["-i", "-r", temp_path])
        .status()
        .map_err(|e| format!("screencapture failed: {e}"))?;

    if !status.success() {
        return Err("cancelled".to_string());
    }

    let data = std::fs::read(temp_path).map_err(|e| format!("read screenshot: {e}"))?;
    let _ = std::fs::remove_file(temp_path);

    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(data)
    ))
}

// --- Windows/Linux: xcap + overlay ---

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn capture_fullscreen(state: tauri::State<'_, ScreenshotCache>) -> Result<String, String> {
    use image::DynamicImage;
    use image::ImageEncoder;
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors.first().ok_or("No monitor found".to_string())?;
    let screenshot = monitor.capture_image().map_err(|e| e.to_string())?;

    let rgb_image = DynamicImage::ImageRgba8(screenshot).to_rgb8();
    let mut jpeg_buf = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, 85)
        .write_image(
            rgb_image.as_raw(),
            rgb_image.width(),
            rgb_image.height(),
            image::ColorType::Rgb8.into(),
        )
        .map_err(|e: image::ImageError| e.to_string())?;

    let data_uri = format!(
        "data:image/jpeg;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(jpeg_buf)
    );

    let mut cache = state.0.lock().map_err(|e| e.to_string())?;
    *cache = Some(data_uri.clone());

    Ok(data_uri)
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn get_screenshot(state: tauri::State<'_, ScreenshotCache>) -> Result<String, String> {
    let cache = state.0.lock().map_err(|e| e.to_string())?;
    cache
        .as_ref()
        .cloned()
        .ok_or("No cached screenshot".to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn crop_image(
    state: tauri::State<'_, ScreenshotCache>,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<String, String> {
    use image::DynamicImage;
    use image::ImageEncoder;

    let cache = state.0.lock().map_err(|e| e.to_string())?;
    let data_uri = cache.as_ref().ok_or("No cached screenshot".to_string())?;

    let base64_data = data_uri
        .strip_prefix("data:image/jpeg;base64,")
        .ok_or("Invalid data URI format")?;
    let img_bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Base64 decode failed: {e}"))?;

    let img = image::load_from_memory(&img_bytes).map_err(|e| format!("Load image failed: {e}"))?;
    let cropped = img.crop_imm(x, y, width, height);

    let mut png_buf = Vec::new();
    cropped
        .write_to(
            &mut std::io::Cursor::new(&mut png_buf),
            image::ImageFormat::Png,
        )
        .map_err(|e| format!("Encode failed: {e}"))?;

    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png_buf)
    ))
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn screenshot_region() -> Result<String, String> {
    Err("Use overlay mode on this platform".to_string())
}

// --- App entry ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(ScreenshotCache(Mutex::new(None)))
        .setup(|app| {
            let shortcut = "CommandOrControl+Shift+A";
            if let Err(e) =
                app.global_shortcut()
                    .on_shortcut(shortcut, move |app_handle, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            let _ = app_handle.emit("screenshot-shortcut", ());
                        }
                    })
            {
                eprintln!("Failed to register shortcut handler: {e}");
            }
            if let Err(e) = app.global_shortcut().register(shortcut) {
                eprintln!("Failed to register shortcut: {e}");
            }
            Ok(())
        })
        .invoke_handler(
            #[cfg(target_os = "macos")]
            tauri::generate_handler![screenshot_region],
            #[cfg(not(target_os = "macos"))]
            tauri::generate_handler![
                screenshot_region,
                capture_fullscreen,
                get_screenshot,
                crop_image
            ],
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
